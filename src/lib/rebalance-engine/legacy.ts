import { openai } from '@/lib/openai/client'
import type { Profile, RebalancingScenario } from '@/types'

export async function runLegacyRebalanceScenarios(input: {
  profile: Profile | null
  holdingsSummary: Array<{
    ticker: string
    company: string | null
    sector: string | null
    assetType: string
    allocationPct: string
    gainLossPct: string
  }>
  totalValue: number
  targetStockPct: number
}): Promise<RebalancingScenario[]> {
  const prompt = `You are a friendly financial advisor for beginner investors. Use plain English.

USER:
- Age: ${input.profile?.age}, Risk: ${input.profile?.risk_tolerance}, Goal: ${input.profile?.investment_goal}
- Horizon: ${input.profile?.investment_horizon}, Dependents: ${input.profile?.num_dependents}
- Income: $${input.profile?.annual_income?.toLocaleString()}

CURRENT PORTFOLIO ($${input.totalValue.toFixed(2)} total):
${JSON.stringify(input.holdingsSummary, null, 2)}

Generate exactly 3 rebalancing scenarios. Return ONLY valid JSON:
{
  "scenarios": [
    {
      "scenario_type": "conservative",
      "title": "<catchy title>",
      "tagline": "<one line>",
      "rationale": "<2 sentences>",
      "expected_outcome": "<1 sentence>",
      "risk_level": <1-4>,
      "strategy_basis": "Threshold rebalancing (±5% bands)",
      "actions": [{"ticker":"<ticker>","company_name":"<name>","action":"buy|sell|hold","current_pct":<number>,"target_pct":<number>,"estimated_amount":<number>,"reason":"<text>","beginner_explanation":"<text>"}]
    },
    {
      "scenario_type": "moderate",
      "title": "<catchy title>",
      "tagline": "<one line>",
      "rationale": "<2 sentences>",
      "expected_outcome": "<1 sentence>",
      "risk_level": <5-7>,
      "strategy_basis": "Hybrid rebalancing",
      "actions": []
    },
    {
      "scenario_type": "aggressive",
      "title": "<catchy title>",
      "tagline": "<one line>",
      "rationale": "<2 sentences>",
      "expected_outcome": "<1 sentence>",
      "risk_level": <8-10>,
      "strategy_basis": "Constant-mix strategy",
      "actions": []
    }
  ]
}

Rules:
- Moderate should roughly target ${input.targetStockPct}% stock exposure
- Include 3-5 actions per scenario`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    })
    const parsed = JSON.parse(completion.choices[0].message.content || '{}')
    return Array.isArray(parsed.scenarios) ? parsed.scenarios : []
  } catch {
    return []
  }
}

export function buildLegacyComparisonSummary(input: {
  deterministicScenarios: RebalancingScenario[]
  legacyScenarios: RebalancingScenario[]
}): {
  deterministic_action_count: number
  legacy_action_count: number
  deterministic_sell_count: number
  legacy_sell_count: number
} {
  const countActions = (scenarios: RebalancingScenario[]) =>
    scenarios.reduce((sum, s) => sum + (s.actions?.length || 0), 0)
  const countSells = (scenarios: RebalancingScenario[]) =>
    scenarios.reduce((sum, s) => sum + (s.actions || []).filter((a) => a.action === 'sell').length, 0)

  return {
    deterministic_action_count: countActions(input.deterministicScenarios),
    legacy_action_count: countActions(input.legacyScenarios),
    deterministic_sell_count: countSells(input.deterministicScenarios),
    legacy_sell_count: countSells(input.legacyScenarios),
  }
}

