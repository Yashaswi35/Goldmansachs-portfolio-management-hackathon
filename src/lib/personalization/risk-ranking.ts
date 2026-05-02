import type { HoldingWithPrice, Profile } from '@/types'

export interface RankedRisk {
  risk: string
  priority: number
  relevance: number
  severity: number
  urgency: number
  plain_english: string
  action: string
}

export const RANKED_RISK_SYSTEM_PROMPT = `You are a fiduciary financial advisor with 20 years of experience.
Your sole job is to protect and grow THIS specific user's wealth.
Never give generic advice. Every sentence must reference something specific from the user's profile below.`

function incomeBracket(annualIncome: number | null | undefined): string {
  const income = annualIncome ?? 0
  if (income <= 0) return 'unknown'
  if (income < 44000) return '$0-$44k'
  if (income < 89000) return '$44k-$89k'
  if (income < 150000) return '$100k-$150k'
  if (income < 190000) return '$150k-$190k'
  return '$190k+'
}

function taxBracketLabel(bracket: Profile['tax_bracket'] | null | undefined): string {
  if (bracket === 'under_44k') return '10-12%'
  if (bracket === '44_89k') return '12-22%'
  if (bracket === '89_190k') return '22-32%'
  if (bracket === '190k_plus') return '32%+'
  return 'unknown'
}

export function buildIspPayload(input: {
  profile: Profile | null
  holdings: HoldingWithPrice[]
  marketContext?: { fed_rate?: number; inflation?: number; market_phase?: string } | null
}) {
  const profile = input.profile
  const retirementTargetAge = 65
  const age = profile?.age ?? 34
  const yearsToGoal = Math.max(0, retirementTargetAge - age)

  const totalValue = input.holdings.reduce((sum, h) => sum + h.current_value, 0)
  const portfolio = input.holdings
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 12)
    .map((h) => ({
      ticker: h.ticker,
      value: Number(h.current_value.toFixed(2)),
      weight: totalValue > 0 ? Number((h.current_value / totalValue).toFixed(4)) : 0,
      cost_basis: Number((h.avg_cost_basis * h.shares).toFixed(2)),
    }))

  const sector_concentration: Record<string, number> = {}
  input.holdings.forEach((h) => {
    const sector = (h.sector || 'other').toLowerCase()
    sector_concentration[sector] = (sector_concentration[sector] || 0) + (totalValue > 0 ? h.current_value / totalValue : 0)
  })

  return {
    age,
    retirement_target_age: retirementTargetAge,
    years_to_goal: yearsToGoal,
    risk_archetype: profile?.risk_archetype || profile?.risk_tolerance || 'moderate',
    income_bracket: incomeBracket(profile?.annual_income),
    income_type: profile?.employment_type || 'unknown',
    emergency_fund: profile?.emergency_fund || 'unknown',
    debt: profile?.debt_type ? [profile.debt_type] : [],
    tax_bracket: taxBracketLabel(profile?.tax_bracket),
    account_type: 'taxable_brokerage',
    behavioral_crash_response: profile?.risk_tolerance === 'aggressive' ? 'buy_more' : 'hold_and_wait',
    experience_level: profile?.experience_level || 'unknown',
    dependents: profile?.num_dependents ?? 0,
    upcoming_events: profile?.has_near_term_expenses ? ['near_term_expenses'] : [],
    portfolio,
    sector_concentration,
    market_context: {
      fed_rate: input.marketContext?.fed_rate ?? 5.25,
      inflation: input.marketContext?.inflation ?? 3.2,
      market_phase: input.marketContext?.market_phase ?? 'late_cycle',
    },
  }
}

export function buildRankedRiskUserPrompt(userIps: ReturnType<typeof buildIspPayload>): string {
  return `USER IPS:
${JSON.stringify(userIps, null, 2)}

TASK:
For each risk in [market, concentration, sequence_of_returns, inflation,
interest_rate, liquidity, behavioral, longevity, currency, legislative],
score it on three axes:
  - Relevance (0-10): how much does this apply to THIS user specifically?
  - Severity (0-10): how bad is it if it materializes for them?
  - Urgency (0-10): how soon could this hurt them?

Priority = Relevance x Severity x Urgency.

Return ONLY risks with Priority > 200, sorted descending.
For each returned risk, write one plain-English sentence (max 25 words)
explaining why it applies to this specific person - no jargon.

OUTPUT FORMAT (JSON only, no preamble):
[{
  "risk": "string",
  "priority": number,
  "relevance": number,
  "severity": number,
  "urgency": number,
  "plain_english": "string referencing their specific situation",
  "action": "string - one concrete thing they can do"
}]`
}

export function normalizeRankedRisks(value: unknown): RankedRisk[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        risk: String(row.risk || '').trim(),
        priority: Number(row.priority || 0),
        relevance: Number(row.relevance || 0),
        severity: Number(row.severity || 0),
        urgency: Number(row.urgency || 0),
        plain_english: String(row.plain_english || '').trim(),
        action: String(row.action || '').trim(),
      }
    })
    .filter((r) => r.risk && r.priority > 200)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 7)
}

