import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/market-data/yahoo'
import type { RebalancingScenario } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portfolio_id } = await request.json()

  const [profileRes, holdingsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('holdings').select('*').eq('portfolio_id', portfolio_id),
  ])

  const profile = profileRes.data
  const holdings = holdingsRes.data || []

  if (holdings.length === 0) {
    return NextResponse.json({ error: 'No holdings to rebalance' }, { status: 400 })
  }

  const tickers = holdings.map((h) => h.ticker)
  const quotes = await getQuotes(tickers)

  let totalValue = 0
  const enrichedHoldings = holdings.map((h) => {
    const quote = quotes[h.ticker.toUpperCase()]
    const current_price = quote?.current_price ?? h.avg_cost_basis
    const current_value = current_price * h.shares
    totalValue += current_value
    return { ...h, current_price, current_value, sector: h.sector || quote?.sector }
  })

  const holdingsSummary = enrichedHoldings.map((h) => ({
    ticker: h.ticker,
    company: h.company_name,
    sector: h.sector,
    assetType: h.asset_type,
    allocationPct: totalValue > 0 ? ((h.current_value / totalValue) * 100).toFixed(1) : '0',
    gainLossPct: (((h.current_price - h.avg_cost_basis) / h.avg_cost_basis) * 100).toFixed(1),
  }))

  const ageBasedStockPct = profile?.age ? Math.max(40, 110 - profile.age) : 70

  const prompt = `You are a friendly financial advisor for beginner investors. Use plain English. Never use jargon without a simple explanation.

USER:
- Age: ${profile?.age}, Risk: ${profile?.risk_tolerance}, Goal: ${profile?.investment_goal}
- Horizon: ${profile?.investment_horizon}, Dependents: ${profile?.num_dependents}
- Income: $${profile?.annual_income?.toLocaleString()}

CURRENT PORTFOLIO ($${totalValue.toFixed(2)} total):
${JSON.stringify(holdingsSummary, null, 2)}

Age-appropriate stock allocation guideline: ~${ageBasedStockPct}% stocks

Generate exactly 3 rebalancing scenarios. Return ONLY valid JSON:
{
  "scenarios": [
    {
      "scenario_type": "conservative",
      "title": "<catchy title>",
      "tagline": "<one line, plain English, what this does>",
      "rationale": "<2 sentences explaining WHY this scenario, specific to their situation>",
      "expected_outcome": "<1 sentence: what changes and why it helps them>",
      "risk_level": <1-4>,
      "strategy_basis": "Threshold rebalancing (±5% bands) — small, safe adjustments",
      "actions": [
        {
          "ticker": "<existing ticker OR new suggestion like BND>",
          "company_name": "<name>",
          "action": "buy|sell|hold",
          "current_pct": <number>,
          "target_pct": <number>,
          "estimated_amount": <dollar amount based on total portfolio>,
          "reason": "<why this specific action>",
          "beginner_explanation": "<explain in plain English as if talking to someone who never invested, 1 sentence>"
        }
      ]
    },
    {
      "scenario_type": "moderate",
      "title": "<catchy title>",
      "tagline": "<one line>",
      "rationale": "<2 sentences>",
      "expected_outcome": "<1 sentence>",
      "risk_level": <5-7>,
      "strategy_basis": "Hybrid rebalancing — annual review + 10% drift bands",
      "actions": [...]
    },
    {
      "scenario_type": "aggressive",
      "title": "<catchy title>",
      "tagline": "<one line>",
      "rationale": "<2 sentences>",
      "expected_outcome": "<1 sentence>",
      "risk_level": <8-10>,
      "strategy_basis": "Constant-mix strategy — buy dips, maximize equity growth",
      "actions": [...]
    }
  ]
}

Rules:
- Conservative: protect capital, reduce volatile positions, add bonds/cash ETFs
- Moderate: age-appropriate allocation (~${ageBasedStockPct}% stocks), fix sector imbalances
- Aggressive: maximize stock exposure, lean into growth sectors, constant-mix discipline
- 3-5 actions per scenario, each with a beginner_explanation that feels like a helpful friend explaining
- Include at least one "hold" action to reassure beginner that not everything needs to change
- Use real tickers for any new suggested additions (BND, AGG, VTI, QQQ, SCHD etc.)
- estimated_amount should be realistic dollar amounts based on the $${totalValue.toFixed(2)} total`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')
  const scenarios: RebalancingScenario[] = result.scenarios || []

  // Persist to DB
  const { data: session } = await supabase
    .from('rebalancing_sessions')
    .insert({ user_id: user.id, portfolio_id, market_context: `Generated ${new Date().toISOString()}` })
    .select()
    .single()

  if (session) {
    await supabase.from('rebalancing_scenarios').insert(
      scenarios.map((s) => ({ ...s, session_id: session.id }))
    )
  }

  return NextResponse.json({ scenarios, session_id: session?.id })
}
