import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'
import type { HoldingWithPrice, PortfolioAnalysis } from '@/types'
import { buildPersonalizedPolicy, buildPolicyDiagnostics } from '@/lib/personalization/policy'
import { applyPortfolioAnalysisCompliance } from '@/lib/personalization/compliance'
import {
  RANKED_RISK_SYSTEM_PROMPT,
  buildIspPayload,
  buildRankedRiskUserPrompt,
  normalizeRankedRisks,
} from '@/lib/personalization/risk-ranking'
import { getOrBuildUserAiContext } from '@/lib/personalization/user-context'

function parseJsonLoose(input: string): unknown {
  const trimmed = (input || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (codeBlockMatch?.[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim())
      } catch {
        return null
      }
    }
    return null
  }
}

function buildDeterministicAnalysisFallback(input: {
  totalValue: number
  diagnostics: ReturnType<typeof buildPolicyDiagnostics>
  profile: Awaited<ReturnType<typeof getOrBuildUserAiContext>>['profile']
  policy: ReturnType<typeof buildPersonalizedPolicy>
}): PortfolioAnalysis {
  const { totalValue, diagnostics, profile, policy } = input
  const flags = diagnostics.concentration_flags || []
  const concentrationTop = Object.entries(diagnostics.sector_concentration || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const stockDrift = diagnostics.stock_pct - policy.target_stock_max_pct
  const bondShortfall = policy.target_bond_min_pct - diagnostics.bond_pct

  const penalty = Math.min(65, flags.length * 12 + (stockDrift > 0 ? Math.min(20, stockDrift) : 0) + (bondShortfall > 0 ? Math.min(15, bondShortfall) : 0))
  const health = Math.max(28, Math.round(92 - penalty))

  const top_risks = [
    ...flags,
    stockDrift > 0 ? `Stock exposure is ${diagnostics.stock_pct.toFixed(1)}%, above your policy max of ${policy.target_stock_max_pct}%.` : null,
    bondShortfall > 0 ? `Bond exposure is ${diagnostics.bond_pct.toFixed(1)}%, below your policy minimum of ${policy.target_bond_min_pct}%.` : null,
    concentrationTop[0] ? `Largest sector is ${concentrationTop[0][0]} at ${concentrationTop[0][1].toFixed(1)}% of your portfolio.` : null,
  ].filter(Boolean).slice(0, 6) as string[]

  const insights = [
    `Your portfolio value is about $${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}. Keep your highest-conviction positions, but right-size oversized risk buckets first.`,
    `Rebalance in small steps to move toward your target mix (stocks ${policy.target_stock_min_pct}-${policy.target_stock_max_pct}%, bonds ${policy.target_bond_min_pct}-${policy.target_bond_max_pct}%).`,
    `Set a repeatable review cadence (monthly or quarterly) so risk drift is corrected early instead of after large swings.`,
  ]

  return {
    health_score: health,
    risk_assessment: `Your portfolio is currently ${health >= 70 ? 'reasonably aligned' : 'showing material drift'} versus your risk policy. Most risk comes from concentration and stock/bond mix imbalance relative to your stated profile.`,
    top_risks,
    ranked_risks: [],
    insights,
    sector_concentration: diagnostics.sector_concentration,
    suggested_additions: [
      {
        ticker: 'BND',
        company_name: 'Vanguard Total Bond Market ETF',
        reason: `Helps improve fixed-income balance for a ${profile?.risk_archetype || profile?.risk_tolerance || 'moderate'} profile.`,
        asset_type: 'bond',
        risk_level: 3,
      },
      {
        ticker: 'VXUS',
        company_name: 'Vanguard Total International Stock ETF',
        reason: 'Adds broad international diversification to reduce single-market concentration.',
        asset_type: 'etf',
        risk_level: 5,
      },
    ],
  }
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
  const holdingsWithPrices = userContext.holdings as HoldingWithPrice[]

  if (holdingsWithPrices.length === 0) {
    return NextResponse.json({
      health_score: 0,
      risk_assessment: 'Add investments to your portfolio to get an analysis.',
      top_risks: [],
      ranked_risks: [],
      insights: ['Start by adding your first investment to see personalized insights.'],
      sector_concentration: {},
      suggested_additions: [],
    } as PortfolioAnalysis)
  }

  const totalValue = userContext.total_value
  const policy = buildPersonalizedPolicy(profile)
  const diagnostics = buildPolicyDiagnostics(
    holdingsWithPrices.map((h) => ({
      ticker: h.ticker,
      current_value: h.current_value,
      asset_type: h.asset_type,
      sector: h.sector,
    })),
    totalValue,
    policy
  )

  const portfolioSummary = holdingsWithPrices.map((h) => ({
    ticker: h.ticker,
    company: h.company_name,
    sector: h.sector,
    shares: h.shares,
    currentValue: h.current_value.toFixed(2),
    allocationPct: h.allocation_pct.toFixed(1),
    gainLossPct: h.gain_loss_pct.toFixed(1),
    assetType: h.asset_type,
  }))

  const prompt = `You are a friendly, encouraging financial guide for beginner investors.
Never use jargon without explaining it. Be warm, clear, and specific.

USER PROFILE:
- Age: ${profile?.age ?? 'unknown'}, Risk tolerance: ${profile?.risk_tolerance ?? 'unknown'}
- Annual income: $${profile?.annual_income?.toLocaleString() ?? 'unknown'}
- Employment: ${profile?.employment_type ?? 'unknown'}
- Dependents: ${profile?.num_dependents ?? 0}
- Investment goal: ${profile?.investment_goal ?? 'unknown'}
- Time horizon: ${profile?.investment_horizon ?? 'unknown'}

PERSONALIZED POLICY CONSTRAINTS (NON-NEGOTIABLE):
- Risk bucket: ${policy.risk_bucket}
- Target stock range: ${policy.target_stock_min_pct}-${policy.target_stock_max_pct}%
- Target bond range: ${policy.target_bond_min_pct}-${policy.target_bond_max_pct}%
- Max single position: ${policy.max_single_position_pct}%
- Max sector concentration: ${policy.max_sector_pct}%
- Current stock pct: ${diagnostics.stock_pct.toFixed(1)}%
- Current bond pct: ${diagnostics.bond_pct.toFixed(1)}%
- Current policy flags: ${diagnostics.concentration_flags.length ? diagnostics.concentration_flags.join(' | ') : 'none'}

PORTFOLIO (Total: $${totalValue.toFixed(2)}):
${JSON.stringify(portfolioSummary, null, 2)}

Analyze this portfolio and return ONLY valid JSON with this exact structure:
{
  "health_score": <number 0-100>,
  "risk_assessment": "<2 sentences, plain English, specific to this person>",
  "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "sector_concentration": {"<sector>": <percentage>},
  "suggested_additions": [
    {
      "ticker": "<ticker>",
      "company_name": "<name>",
      "reason": "<why this fits their profile, 1 sentence>",
      "asset_type": "<stock|etf|bond>",
      "risk_level": <1-10>
    }
  ]
}

Rules:
- health_score: 0=terrible, 100=perfect for their risk profile
- top_risks: specific to their holdings, no generic advice
- insights: actionable, encouraging, beginner-friendly
- suggested_additions: 2-3 suggestions that complement their portfolio gaps
- Never say "diversify" without explaining what that means`

  let analysis: PortfolioAnalysis = buildDeterministicAnalysisFallback({
    totalValue,
    diagnostics,
    profile,
    policy,
  })
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })
    const parsed = JSON.parse(completion.choices[0].message.content || '{}') as Partial<PortfolioAnalysis>
    analysis = {
      ...analysis,
      ...parsed,
      top_risks: Array.isArray(parsed.top_risks) ? parsed.top_risks : analysis.top_risks,
      insights: Array.isArray(parsed.insights) ? parsed.insights : analysis.insights,
      suggested_additions: Array.isArray(parsed.suggested_additions) ? parsed.suggested_additions : analysis.suggested_additions,
      sector_concentration: parsed.sector_concentration && typeof parsed.sector_concentration === 'object'
        ? parsed.sector_concentration
        : analysis.sector_concentration,
      health_score: typeof parsed.health_score === 'number' ? parsed.health_score : analysis.health_score,
      risk_assessment: typeof parsed.risk_assessment === 'string' ? parsed.risk_assessment : analysis.risk_assessment,
    } as PortfolioAnalysis
  } catch {
    // deterministic fallback remains
  }

  let ranked_risks: NonNullable<PortfolioAnalysis['ranked_risks']> = []
  try {
    const riskRankingCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: RANKED_RISK_SYSTEM_PROMPT },
        { role: 'user', content: buildRankedRiskUserPrompt(buildIspPayload({ profile, holdings: holdingsWithPrices, marketContext: userContext.market_context })) },
      ],
      temperature: 0.2,
    })

    const rankedRiskParsed = parseJsonLoose(riskRankingCompletion.choices[0].message.content || '')
    ranked_risks = normalizeRankedRisks(
      Array.isArray(rankedRiskParsed)
        ? rankedRiskParsed
        : (rankedRiskParsed as { risks?: unknown[] } | null)?.risks || []
    )
  } catch {
    ranked_risks = []
  }
  const existingRisks = Array.isArray(analysis.top_risks) ? analysis.top_risks : []
  const rankedRiskLabels = ranked_risks.map((r) => `${r.risk}: ${r.plain_english}`)
  const deterministicRisks = diagnostics.concentration_flags.slice(0, 3)
  const top_risks = Array.from(new Set([...deterministicRisks, ...rankedRiskLabels, ...existingRisks])).slice(0, 6)

  const merged = {
    ...analysis,
    sector_concentration: diagnostics.sector_concentration,
    top_risks,
    ranked_risks,
  } as PortfolioAnalysis

  return NextResponse.json(
    applyPortfolioAnalysisCompliance(merged, profile, policy, diagnostics)
  )
}
