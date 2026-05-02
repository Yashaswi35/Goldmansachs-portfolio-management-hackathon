import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const ageBasedStocks = Math.max(40, 110 - (profile.age || 30))
  const ageBasedBonds = Math.min(50, Math.max(10, (profile.age || 30) - 10))

  const riskMultiplier: Record<string, number> = {
    conservative: -20, moderately_conservative: -10, moderate: 0, moderately_aggressive: 10, aggressive: 20
  }
  const adjustment = riskMultiplier[profile.risk_archetype || 'moderate'] || 0
  const targetStocks = Math.min(90, Math.max(20, ageBasedStocks + adjustment))
  const targetBonds = Math.min(60, Math.max(5, ageBasedBonds - (adjustment / 2)))
  const targetCash = Math.max(5, 100 - targetStocks - targetBonds)

  const prompt = `You are a financial advisor writing an Investment Policy Statement for a beginner investor.
Write in warm, plain English — no jargon, no acronyms without explanation.
This statement will be their financial north star for every investment decision.

PROFILE:
- Name: ${profile.full_name}, Age: ${profile.age}
- Employment: ${profile.employment_type}, Income: $${Number(profile.annual_income || 0).toLocaleString()}
- Marital status: ${profile.marital_status}, Dependents: ${profile.num_dependents || 0}
- Goal: ${profile.investment_goal}, Timeline: ${profile.investment_horizon}
- Risk tolerance: ${profile.risk_archetype || profile.risk_tolerance}
- Emergency fund: ${profile.emergency_fund || 'unknown'}
- Debt: ${profile.debt_type || 'none'}
- Experience: ${profile.experience_level || 'beginner'}
- Near-term expenses: ${profile.has_near_term_expenses ? 'Yes' : 'No'}

TARGET ALLOCATION: ~${targetStocks}% stocks, ~${targetBonds}% bonds, ~${targetCash}% cash

Write a 3-4 sentence IPS that:
1. States who they are and their primary goal in plain terms
2. Explains their risk tolerance and what that means for them specifically
3. States their target allocation and why it fits their life situation
4. Gives them one clear decision rule: "When in doubt, ask yourself: does this investment help me [goal] within [timeline]?"

Return ONLY a JSON object: {"ips": "...", "target_stock_pct": ${targetStocks}, "target_bond_pct": ${targetBonds}, "target_cash_pct": ${targetCash}}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  })

  const result = JSON.parse(completion.choices[0].message.content || '{}')

  await supabase.from('profiles').update({
    investment_policy_statement: result.ips,
    target_stock_pct: result.target_stock_pct || targetStocks,
    target_bond_pct: result.target_bond_pct || targetBonds,
    target_cash_pct: result.target_cash_pct || targetCash,
  }).eq('id', user.id)

  return NextResponse.json({
    investment_policy_statement: result.ips,
    target_stock_pct: result.target_stock_pct || targetStocks,
    target_bond_pct: result.target_bond_pct || targetBonds,
    target_cash_pct: result.target_cash_pct || targetCash,
  })
}
