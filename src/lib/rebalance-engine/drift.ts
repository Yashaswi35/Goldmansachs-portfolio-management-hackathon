import type { DriftDiagnostic, PortfolioSnapshot, RebalanceMode, TargetAllocation } from '@/lib/rebalance-engine/types'

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000))
}

export function detectDrift(input: {
  snapshot: PortfolioSnapshot
  target: TargetAllocation
  mode: RebalanceMode
  thresholdPct?: number
  nowIso?: string
  lastRebalanceAt?: string | null
}): DriftDiagnostic {
  const threshold = input.thresholdPct ?? 5
  const by_ticker_drift_pct: Record<string, number> = {}
  let max_abs_drift_pct = 0

  input.snapshot.holdings.forEach((h) => {
    const targetPct = input.target.by_ticker_target_pct[h.ticker] || 0
    const drift = h.current_pct - targetPct
    by_ticker_drift_pct[h.ticker] = drift
    max_abs_drift_pct = Math.max(max_abs_drift_pct, Math.abs(drift))
  })

  const threshold_triggered = max_abs_drift_pct > threshold
  const nowIso = input.nowIso || new Date().toISOString()
  const calendar_triggered = !input.lastRebalanceAt
    ? true
    : daysBetween(nowIso, input.lastRebalanceAt) >= 90

  const should_rebalance =
    input.mode === 'threshold'
      ? threshold_triggered
      : input.mode === 'calendar'
        ? calendar_triggered
        : threshold_triggered || calendar_triggered

  const reasonParts: string[] = []
  if (threshold_triggered) reasonParts.push(`Max drift ${max_abs_drift_pct.toFixed(2)}% > ${threshold}%`)
  if (calendar_triggered) reasonParts.push('Quarterly cadence trigger')
  if (reasonParts.length === 0) reasonParts.push('Within drift threshold and cadence window')

  return {
    by_ticker_drift_pct,
    max_abs_drift_pct,
    threshold_triggered,
    calendar_triggered,
    should_rebalance,
    trigger_reason: reasonParts.join(' | '),
  }
}

