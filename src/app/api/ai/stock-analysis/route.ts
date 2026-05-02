import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'
import { getFundamentalsForTickers } from '@/lib/market-data/yahoo'
import { buildPersonalizedPolicy } from '@/lib/personalization/policy'
import { applyStockAnalysisCompliance } from '@/lib/personalization/compliance'
import { getOrBuildUserAiContext } from '@/lib/personalization/user-context'

export interface StockAnalysis {
  ticker: string
  company_name: string
  what_is_it: string
  performance_signal: 'bullish' | 'neutral' | 'bearish'
  performance_reason: string
  profile_fit: 'excellent' | 'good' | 'caution' | 'alert'
  profile_fit_reason: string
  action: 'ADD' | 'HOLD' | 'TRIM' | 'EXIT'
  action_reason: string
  risk_flags: string[]
  key_metrics: { label: string; value: string }[]
}

const analysisCache = new Map<string, { data: StockAnalysis[]; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

type EnrichedHolding = {
  id: string
  ticker: string
  company: string
  sector: string
  industry: string | null
  assetType: string
  shares: number
  avgCost: number
  currentPrice: number
  currentValue: number
  gainLossPct: number
  dailyChangePct: number
  allocationPct: number
  peRatio: number | null
  forwardPe: number | null
  beta: number | null
  dividendYieldPct: number | null
  profitMarginPct: number | null
  revenueGrowthPct: number | null
  debtToEquity: number | null
  returnOnEquityPct: number | null
  marketCap: number | null
  recommendation: string | null
  targetMeanPrice: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
}

function toNum(n: unknown, fallback = 0): number {
  return typeof n === 'number' && isFinite(n) ? n : fallback
}

function toPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function buildFallbackAnalysis(h: EnrichedHolding, riskLabel: string): StockAnalysis {
  const concentrationRisk = h.allocationPct >= 25
  const severeLossRisk = h.gainLossPct <= -20
  const highVolatilityRisk = (h.beta ?? 1) > 1.4
  const conservativeProfile = /conservative/i.test(riskLabel)
  const performance_signal: StockAnalysis['performance_signal'] =
    h.gainLossPct > 8 ? 'bullish' : h.gainLossPct < -8 ? 'bearish' : 'neutral'

  const profile_fit: StockAnalysis['profile_fit'] =
    conservativeProfile && (highVolatilityRisk || h.assetType === 'crypto')
      ? 'alert'
      : concentrationRisk || severeLossRisk
        ? 'caution'
        : highVolatilityRisk
          ? 'good'
          : 'excellent'

  const action: StockAnalysis['action'] =
    severeLossRisk && concentrationRisk
      ? 'TRIM'
      : profile_fit === 'alert'
        ? 'TRIM'
        : performance_signal === 'bullish'
          ? 'HOLD'
          : 'HOLD'

  const risk_flags = [
    concentrationRisk ? `High concentration: ${h.allocationPct.toFixed(1)}% of portfolio` : null,
    severeLossRisk ? `Large unrealized loss: ${toPercent(h.gainLossPct)}` : null,
    highVolatilityRisk ? `Higher volatility (beta ${h.beta?.toFixed(2)})` : null,
  ].filter(Boolean) as string[]

  return {
    ticker: h.ticker,
    company_name: h.company,
    what_is_it: `${h.company} is a ${h.sector.toLowerCase()} ${h.assetType}.`,
    performance_signal,
    performance_reason: `${h.ticker} is ${toPercent(h.gainLossPct)} vs your average cost with ${toPercent(h.dailyChangePct, 2)} today.`,
    profile_fit,
    profile_fit_reason: `${h.assetType.toUpperCase()} in ${h.sector} with ${(h.beta ?? 1).toFixed(2)} beta is ${profile_fit === 'alert' ? 'not aligned' : 'reasonably aligned'} with a ${riskLabel} profile.`,
    action,
    action_reason: action === 'TRIM'
      ? 'Reduce position size to lower downside and concentration risk.'
      : 'Keep position size steady while monitoring fundamentals and risk balance.',
    risk_flags,
    key_metrics: [
      { label: 'Gain/Loss', value: toPercent(h.gainLossPct) },
      { label: 'Allocation', value: `${h.allocationPct.toFixed(1)}%` },
      { label: 'P/E', value: h.peRatio ? h.peRatio.toFixed(1) : 'N/A' },
    ],
  }
}

function normalizeAnalyses(raw: unknown): StockAnalysis[] {
  if (!raw || typeof raw !== 'object') return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybe = raw as any
  if (Array.isArray(maybe.analyses)) return maybe.analyses as StockAnalysis[]
  if (Array.isArray(maybe)) return maybe as StockAnalysis[]
  return []
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portfolio_id } = await request.json()

  const userContext = await getOrBuildUserAiContext({
    supabase,
    userId: user.id,
    portfolioId: portfolio_id,
  })
  const profile = userContext.profile
  const holdings = userContext.holdings
  if (!holdings.length) return NextResponse.json([])

  const profileFingerprint = [
    profile?.risk_archetype,
    profile?.risk_tolerance,
    profile?.investment_goal,
    profile?.investment_horizon,
    profile?.age,
    profile?.emergency_fund,
    profile?.debt_type,
    profile?.experience_level,
    profile?.target_stock_pct,
    profile?.target_bond_pct,
    profile?.target_cash_pct,
  ].join('|')

  const cacheKey = `${user.id}-${portfolio_id}-${profileFingerprint}-${holdings
    .map((h) => `${h.id}:${h.shares}:${h.avg_cost_basis}`)
    .sort()
    .join('|')}`
  const cached = analysisCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const tickers = holdings.map((h) => h.ticker)
  const fundamentalsByTicker = await getFundamentalsForTickers(tickers)

  const totalValue = userContext.total_value
  const enriched: EnrichedHolding[] = holdings.map((h) => {
    const fundamentals = fundamentalsByTicker[h.ticker.toUpperCase()]
    const price = h.current_price
    const value = h.current_value
    const gainLossPct = h.gain_loss_pct

    return {
      id: h.id,
      ticker: h.ticker,
      company: h.company_name || h.ticker,
      sector: h.sector || fundamentals?.sector || 'Unknown',
      industry: fundamentals?.industry || null,
      assetType: h.asset_type || 'stock',
      shares: h.shares,
      avgCost: h.avg_cost_basis,
      currentPrice: price,
      currentValue: value,
      gainLossPct,
      dailyChangePct: toNum(h.daily_change_pct),
      allocationPct: h.allocation_pct,
      peRatio: fundamentals?.pe_ratio ?? null,
      forwardPe: fundamentals?.forward_pe ?? null,
      beta: fundamentals?.beta ?? null,
      dividendYieldPct: fundamentals?.dividend_yield_pct ?? null,
      profitMarginPct: fundamentals?.profit_margin_pct ?? null,
      revenueGrowthPct: fundamentals?.revenue_growth_pct ?? null,
      debtToEquity: fundamentals?.debt_to_equity ?? null,
      returnOnEquityPct: fundamentals?.return_on_equity_pct ?? null,
      marketCap: fundamentals?.market_cap ?? null,
      recommendation: fundamentals?.recommendation ?? null,
      targetMeanPrice: fundamentals?.target_mean_price ?? null,
      fiftyTwoWeekHigh: fundamentals?.fifty_two_week_high ?? null,
      fiftyTwoWeekLow: fundamentals?.fifty_two_week_low ?? null,
    }
  })
  const policy = buildPersonalizedPolicy(profile)
  const riskLabel = policy.risk_bucket

  const prompt = `You are a senior financial advisor analyzing a beginner investor's portfolio. Be specific, honest, and use plain English — no jargon without explanation. Be warm but direct. Flag real risks clearly.

USER INVESTMENT PROFILE:
- Name: ${profile?.full_name}, Age: ${profile?.age}
- Risk tolerance: ${profile?.risk_archetype || profile?.risk_tolerance}
- Investment goal: ${profile?.investment_goal}, Timeline: ${profile?.investment_horizon}
- Income: $${profile?.annual_income?.toLocaleString()}
- Emergency fund: ${profile?.emergency_fund || 'unknown'}
- Debt situation: ${profile?.debt_type || 'unknown'}
- Experience: ${profile?.experience_level || 'beginner'}
- Dependents: ${profile?.num_dependents || 0}
${profile?.investment_policy_statement ? `IPS: ${profile.investment_policy_statement}` : ''}

PERSONALIZED POLICY CONSTRAINTS (NON-NEGOTIABLE):
- Risk bucket: ${policy.risk_bucket}
- Target stock range: ${policy.target_stock_min_pct}-${policy.target_stock_max_pct}%
- Target bond range: ${policy.target_bond_min_pct}-${policy.target_bond_max_pct}%
- Max single position: ${policy.max_single_position_pct}%
- Max sector concentration: ${policy.max_sector_pct}%

PORTFOLIO (Total: $${totalValue.toFixed(2)}):
${JSON.stringify(enriched, null, 2)}

Analyze EACH stock/ETF and return JSON array. For each holding:
- what_is_it: 1 sentence plain English description of the company/fund
- performance_signal: "bullish" | "neutral" | "bearish" based on price vs cost, daily change, proximity to 52w high/low
- performance_reason: 1 sentence why (cite actual numbers)
- profile_fit: "excellent" | "good" | "caution" | "alert" based on how well this holding matches the user's risk profile, age, and goals
- profile_fit_reason: 1 sentence why (be specific — mention risk level, volatility, asset type)
- action: "ADD" | "HOLD" | "TRIM" | "EXIT"
- action_reason: 1 sentence why (personalized to this user's situation)
- risk_flags: array of 0-2 specific warnings (e.g. "Down 42% from your cost — approaching stop-loss territory", "Represents 35% of portfolio — concentrated position")
- key_metrics: array of 3 most relevant metrics for a beginner [{label, value}] (e.g. gain/loss %, allocation %, 52w position)

Return ONLY a valid JSON object in this shape: {"analyses": [...array of stock analysis objects...]}
Be dramatically honest where needed — if a conservative 62-year-old holds 40% in speculative biotech, say so clearly.
Critical: Use each holding's ticker exactly as provided in the input when generating output.`

  let analyses: StockAnalysis[] = []
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const raw = JSON.parse(completion.choices[0].message.content || '{"analyses":[]}')
    analyses = normalizeAnalyses(raw)
  } catch {
    analyses = []
  }

  const analysesByTicker = new Map(
    analyses
      .filter((a) => a?.ticker)
      .map((a) => [a.ticker.toUpperCase(), a])
  )

  const merged = enriched.map((h) => {
    const fromModel = analysesByTicker.get(h.ticker.toUpperCase())
    if (fromModel) {
      return {
        ...fromModel,
        ticker: h.ticker,
        company_name: h.company,
        performance_reason:
          fromModel.performance_reason || `${h.ticker} is ${toPercent(h.gainLossPct)} vs your cost basis.`,
        key_metrics:
          fromModel.key_metrics?.length
            ? fromModel.key_metrics
            : [
                { label: 'Gain/Loss', value: toPercent(h.gainLossPct) },
                { label: 'Allocation', value: `${h.allocationPct.toFixed(1)}%` },
                { label: 'Price', value: formatMoney(h.currentPrice) },
              ],
      }
    }
    return buildFallbackAnalysis(h, riskLabel)
  })

  const compliant = applyStockAnalysisCompliance(merged)
  analysisCache.set(cacheKey, { data: compliant, ts: Date.now() })
  return NextResponse.json(compliant)
}
