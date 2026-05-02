import type { PortfolioAnalysis, Profile, RebalancingScenario } from '@/types'
import type { StockAnalysis } from '@/app/api/ai/stock-analysis/route'
import type { PolicyDiagnostics, PersonalizedPolicy } from '@/lib/personalization/policy'

const IMPERATIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\bmust\b/gi, 'should consider'],
  [/\bguaranteed?\b/gi, 'not guaranteed'],
  [/\brisk[- ]?free\b/gi, 'lower risk'],
  [/\bcertainly\b/gi, 'potentially'],
  [/\bdefinitely\b/gi, 'likely'],
  [/\bbuy now\b/gi, 'consider adding gradually'],
  [/\bsell immediately\b/gi, 'consider reducing exposure'],
]

function sanitizeAdviceText(text: string | null | undefined): string {
  let out = (text || '').trim()
  if (!out) return 'Based on your profile and holdings, consider a measured approach and review fit before acting.'
  for (const [pattern, replacement] of IMPERATIVE_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function withDisclosure(text: string): string {
  const disclosure = ' This is educational information, not individualized investment advice, and should be reviewed against your personal circumstances.'
  if (text.includes('educational information, not individualized investment advice')) return text
  return `${text}${disclosure}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function normalizeScenarioRiskLevel(type: RebalancingScenario['scenario_type'], level: number): number {
  if (type === 'conservative') return clamp(level, 1, 4)
  if (type === 'moderate') return clamp(level, 5, 7)
  return clamp(level, 8, 10)
}

function normalizeAction(action: string | null | undefined): 'buy' | 'sell' | 'hold' {
  const v = (action || '').toLowerCase()
  if (v === 'buy' || v === 'sell' || v === 'hold') return v
  return 'hold'
}

function ensureSuitabilityLine(rationale: string, profile: Profile | null, policy: PersonalizedPolicy): string {
  const base = sanitizeAdviceText(rationale)
  const key = `Tailored to your ${policy.risk_bucket.replace('_', ' ')} profile, ${profile?.investment_goal || 'investment goals'}, and ${profile?.investment_horizon || 'time horizon'}.`
  return base.includes('Tailored to your') ? base : `${base} ${key}`
}

export function applyPortfolioAnalysisCompliance(
  analysis: PortfolioAnalysis,
  profile: Profile | null,
  policy: PersonalizedPolicy,
  diagnostics: PolicyDiagnostics
): PortfolioAnalysis {
  const safeInsights = (analysis.insights || []).slice(0, 5).map((i) => sanitizeAdviceText(i))
  const safeTopRisks = Array.from(new Set([...(analysis.top_risks || []), ...diagnostics.concentration_flags]))
    .slice(0, 6)
    .map((r) => sanitizeAdviceText(r))
  const safeRankedRisks = (analysis.ranked_risks || []).slice(0, 7).map((r) => ({
    ...r,
    risk: sanitizeAdviceText(r.risk),
    plain_english: sanitizeAdviceText(r.plain_english),
    action: sanitizeAdviceText(r.action),
    priority: Math.max(0, Number.isFinite(r.priority) ? r.priority : 0),
    relevance: clamp(Number.isFinite(r.relevance) ? r.relevance : 0, 0, 10),
    severity: clamp(Number.isFinite(r.severity) ? r.severity : 0, 0, 10),
    urgency: clamp(Number.isFinite(r.urgency) ? r.urgency : 0, 0, 10),
  }))

  const suggested = (analysis.suggested_additions || []).slice(0, 3).map((s) => ({
    ...s,
    reason: sanitizeAdviceText(s.reason),
    risk_level: clamp(Number.isFinite(s.risk_level) ? s.risk_level : 5, 1, 10),
  }))

  return {
    ...analysis,
    health_score: clamp(Number.isFinite(analysis.health_score) ? analysis.health_score : 50, 0, 100),
    risk_assessment: withDisclosure(
      ensureSuitabilityLine(analysis.risk_assessment || '', profile, policy)
    ),
    top_risks: safeTopRisks,
    ranked_risks: safeRankedRisks,
    insights: safeInsights,
    sector_concentration: diagnostics.sector_concentration,
    suggested_additions: suggested,
  }
}

export function applyRebalanceCompliance(
  scenarios: RebalancingScenario[],
  profile: Profile | null,
  policy: PersonalizedPolicy
): RebalancingScenario[] {
  return scenarios.map((s) => {
    const normalizedActions = (s.actions || []).slice(0, 6).map((a) => ({
      ...a,
      action: normalizeAction(a.action),
      estimated_amount: Math.max(0, Number.isFinite(a.estimated_amount) ? a.estimated_amount : 0),
      reason: sanitizeAdviceText(a.reason),
      beginner_explanation: sanitizeAdviceText(a.beginner_explanation),
      current_pct: Number.isFinite(a.current_pct) ? a.current_pct : 0,
      target_pct: Number.isFinite(a.target_pct) ? a.target_pct : 0,
    }))

    const hasHold = normalizedActions.some((a) => a.action === 'hold')
    if (!hasHold && normalizedActions.length > 0) {
      normalizedActions[normalizedActions.length - 1] = {
        ...normalizedActions[normalizedActions.length - 1],
        action: 'hold',
        estimated_amount: 0,
        reason: 'Keep this position unchanged for now to avoid over-trading.',
        beginner_explanation: 'Not every position needs a trade right now; holding can reduce unnecessary churn and costs.',
      }
    }

    return {
      ...s,
      rationale: withDisclosure(ensureSuitabilityLine(s.rationale || '', profile, policy)),
      expected_outcome: sanitizeAdviceText(s.expected_outcome),
      strategy_basis: sanitizeAdviceText(s.strategy_basis),
      risk_level: normalizeScenarioRiskLevel(s.scenario_type, Number.isFinite(s.risk_level) ? s.risk_level : 5),
      actions: normalizedActions,
    }
  })
}

export function applyStockAnalysisCompliance(items: StockAnalysis[]): StockAnalysis[] {
  return (items || []).map((a) => ({
    ...a,
    what_is_it: sanitizeAdviceText(a.what_is_it),
    performance_reason: sanitizeAdviceText(a.performance_reason),
    profile_fit_reason: sanitizeAdviceText(a.profile_fit_reason),
    action_reason: withDisclosure(sanitizeAdviceText(a.action_reason)),
    risk_flags: (a.risk_flags || []).slice(0, 3).map((f) => sanitizeAdviceText(f)),
    key_metrics: (a.key_metrics || []).slice(0, 4),
  }))
}

