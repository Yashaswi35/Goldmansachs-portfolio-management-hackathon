import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/market-data/yahoo'
import type { HoldingWithPrice, PortfolioAnalysis } from '@/types'

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
    return NextResponse.json({
      health_score: 0,
      risk_assessment: 'Add investments to your portfolio to get an analysis.',
      top_risks: [],
      insights: ['Start by adding your first investment to see personalized insights.'],
      sector_concentration: {},
      suggested_additions: [],
    } as PortfolioAnalysis)
  }

  const tickers = holdings.map((h) => h.ticker)
  const quotes = await getQuotes(tickers)

  let totalValue = 0
  const holdingsWithPrices: HoldingWithPrice[] = holdings.map((h) => {
    const quote = quotes[h.ticker.toUpperCase()]
    const current_price = quote?.current_price ?? h.avg_cost_basis
    const current_value = current_price * h.shares
    totalValue += current_value
    return {
      ...h,
      current_price,
      daily_change_pct: quote?.daily_change_pct ?? 0,
      current_value,
      gain_loss: current_value - h.avg_cost_basis * h.shares,
      gain_loss_pct: ((current_price - h.avg_cost_basis) / h.avg_cost_basis) * 100,
      allocation_pct: 0,
    }
  })

  holdingsWithPrices.forEach((h) => {
    h.allocation_pct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
  })

  const portfolioSummary = holdingsWithPrices.map((h) => ({
    ticker: h.ticker,
    company: h.company_name,
    sector: h.sector || quotes[h.ticker.toUpperCase()]?.sector,
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

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const analysis = JSON.parse(completion.choices[0].message.content || '{}') as PortfolioAnalysis
  return NextResponse.json(analysis)
}
