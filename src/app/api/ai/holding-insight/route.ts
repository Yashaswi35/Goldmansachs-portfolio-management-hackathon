import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { getFundamentals, getPriceHistory, getQuote } from '@/lib/market-data/yahoo'
import { buildPersonalizedPolicy } from '@/lib/personalization/policy'
import { getOrBuildUserAiContext } from '@/lib/personalization/user-context'

interface HoldingInsightResponse {
  ticker: string
  company_name: string
  asset_type: string
  sector: string
  industry: string | null
  current_price: number
  daily_change_pct: number
  history: Array<{ date: string; close: number }>
  fundamentals: {
    market_cap: number | null
    pe_ratio: number | null
    forward_pe: number | null
    beta: number | null
    dividend_yield_pct: number | null
    revenue_growth_pct: number | null
    profit_margin_pct: number | null
    debt_to_equity: number | null
    return_on_equity_pct: number | null
    target_mean_price: number | null
    recommendation: string | null
    fifty_two_week_high: number | null
    fifty_two_week_low: number | null
  }
  opinion: {
    verdict: 'Strong Fit' | 'Fit' | 'Watch' | 'Misaligned'
    summary: string
    personal_fit: string
    key_points: string[]
    risk_watch: string[]
  }
}

function sanitize(text: string | null | undefined): string {
  const t = (text || '').trim()
  if (!t) return ''
  return t
    .replace(/\bmust\b/gi, 'should consider')
    .replace(/\bguaranteed?\b/gi, 'not guaranteed')
    .replace(/\brisk[- ]?free\b/gi, 'lower risk')
    .replace(/\bbuy now\b/gi, 'consider adding gradually')
    .replace(/\bsell immediately\b/gi, 'consider reducing exposure')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portfolio_id, holding_id, period } = await request.json()
  if (!portfolio_id || !holding_id) {
    return NextResponse.json({ error: 'portfolio_id and holding_id are required' }, { status: 400 })
  }
  const chartPeriod: '1mo' | '3mo' | '6mo' | '1y' = ['1mo', '3mo', '6mo', '1y'].includes(period) ? period : '3mo'

  const userContext = await getOrBuildUserAiContext({
    supabase,
    userId: user.id,
    portfolioId: portfolio_id,
  })
  const profile = userContext.profile
  const holding = userContext.holdings.find((h) => h.id === holding_id)
  if (!holding) return NextResponse.json({ error: 'Holding not found' }, { status: 404 })

  const policy = buildPersonalizedPolicy(profile)
  const quote = await getQuote(holding.ticker)
  const fundamentals = await getFundamentals(holding.ticker)
  const historyRaw = await getPriceHistory(holding.ticker, chartPeriod)

  const currentPrice = quote?.current_price ?? holding.avg_cost_basis
  const history = historyRaw
    .map((p) => ({ date: p.date, close: Number(p.close) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (history.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    history.push({ date: today, close: Number(currentPrice.toFixed(2)) })
  }

  const cost = Number(holding.avg_cost_basis || 0)
  const gainLossPct = cost > 0 ? ((currentPrice - cost) / cost) * 100 : 0

  const prompt = `You are a portfolio advisor writing one holding-level note for a beginner investor.
Be plain English, specific, and profile-aware.

USER PROFILE:
- Name: ${profile?.full_name || 'Investor'}
- Age: ${profile?.age ?? 'unknown'}
- Risk style: ${policy.risk_bucket}
- Goal: ${profile?.investment_goal || 'unknown'}
- Horizon: ${profile?.investment_horizon || 'unknown'}
- Emergency fund: ${profile?.emergency_fund || 'unknown'}
- Debt type: ${profile?.debt_type || 'unknown'}
- Experience: ${profile?.experience_level || 'unknown'}

HOLDING:
- Ticker: ${holding.ticker}
- Company: ${holding.company_name || holding.ticker}
- Asset type: ${holding.asset_type || 'stock'}
- Shares: ${holding.shares}
- Avg cost basis: ${holding.avg_cost_basis}
- Current price: ${currentPrice}
- Gain/loss % vs cost: ${gainLossPct.toFixed(2)}%
- Daily change %: ${(quote?.daily_change_pct ?? 0).toFixed(2)}%
- Sector: ${fundamentals?.sector || quote?.sector || holding.sector || 'Unknown'}
- Industry: ${fundamentals?.industry || 'Unknown'}
- Fundamentals: ${JSON.stringify({
    pe: fundamentals?.pe_ratio,
    forward_pe: fundamentals?.forward_pe,
    beta: fundamentals?.beta,
    market_cap: fundamentals?.market_cap,
    revenue_growth_pct: fundamentals?.revenue_growth_pct,
    profit_margin_pct: fundamentals?.profit_margin_pct,
    debt_to_equity: fundamentals?.debt_to_equity,
    roe_pct: fundamentals?.return_on_equity_pct,
    target_mean_price: fundamentals?.target_mean_price,
    recommendation: fundamentals?.recommendation,
  })}

Return only JSON in this shape:
{
  "verdict": "Strong Fit" | "Fit" | "Watch" | "Misaligned",
  "summary": "2 concise sentences",
  "personal_fit": "1 sentence on profile-fit",
  "key_points": ["point1", "point2", "point3"],
  "risk_watch": ["risk1", "risk2"]
}

Rules:
- No guarantees or imperative trading commands.
- Educational tone only.
- Personalize to this user's risk style and goal.`

  let opinion: HoldingInsightResponse['opinion'] = {
    verdict: 'Fit',
    summary: 'This position has mixed signals and should be reviewed in context of your overall portfolio.',
    personal_fit: 'It appears reasonably aligned with your current profile, with normal monitoring.',
    key_points: [
      `Current gain/loss is ${gainLossPct.toFixed(2)}% versus your cost basis.`,
      `Daily move is ${(quote?.daily_change_pct ?? 0).toFixed(2)}%.`,
      `Sector exposure is ${fundamentals?.sector || quote?.sector || holding.sector || 'Unknown'}.`,
    ],
    risk_watch: ['Monitor concentration and volatility before making changes.'],
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })
    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    opinion = {
      verdict: ['Strong Fit', 'Fit', 'Watch', 'Misaligned'].includes(parsed.verdict) ? parsed.verdict : opinion.verdict,
      summary: sanitize(parsed.summary) || opinion.summary,
      personal_fit: sanitize(parsed.personal_fit) || opinion.personal_fit,
      key_points: Array.isArray(parsed.key_points) && parsed.key_points.length > 0
        ? parsed.key_points.map((p: string) => sanitize(p)).filter(Boolean).slice(0, 4)
        : opinion.key_points,
      risk_watch: Array.isArray(parsed.risk_watch) && parsed.risk_watch.length > 0
        ? parsed.risk_watch.map((p: string) => sanitize(p)).filter(Boolean).slice(0, 3)
        : opinion.risk_watch,
    }
  } catch {
    // keep deterministic fallback
  }

  const response: HoldingInsightResponse = {
    ticker: holding.ticker,
    company_name: holding.company_name || holding.ticker,
    asset_type: holding.asset_type || 'stock',
    sector: fundamentals?.sector || quote?.sector || holding.sector || 'Unknown',
    industry: fundamentals?.industry || null,
    current_price: currentPrice,
    daily_change_pct: quote?.daily_change_pct ?? 0,
    history,
    fundamentals: {
      market_cap: fundamentals?.market_cap ?? quote?.market_cap ?? null,
      pe_ratio: fundamentals?.pe_ratio ?? quote?.pe_ratio ?? null,
      forward_pe: fundamentals?.forward_pe ?? null,
      beta: fundamentals?.beta ?? null,
      dividend_yield_pct: fundamentals?.dividend_yield_pct ?? null,
      revenue_growth_pct: fundamentals?.revenue_growth_pct ?? null,
      profit_margin_pct: fundamentals?.profit_margin_pct ?? null,
      debt_to_equity: fundamentals?.debt_to_equity ?? null,
      return_on_equity_pct: fundamentals?.return_on_equity_pct ?? null,
      target_mean_price: fundamentals?.target_mean_price ?? null,
      recommendation: fundamentals?.recommendation ?? null,
      fifty_two_week_high: fundamentals?.fifty_two_week_high ?? quote?.fifty_two_week_high ?? null,
      fifty_two_week_low: fundamentals?.fifty_two_week_low ?? quote?.fifty_two_week_low ?? null,
    },
    opinion: {
      ...opinion,
      summary: `${sanitize(opinion.summary)} This is educational information, not individualized investment advice.`,
    },
  }

  return NextResponse.json(response)
}

