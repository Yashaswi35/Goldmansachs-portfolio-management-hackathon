import { buildPortfolioSnapshot } from '@/lib/rebalance-engine/snapshot'
import { buildTargets } from '@/lib/rebalance-engine/targets'
import { detectDrift } from '@/lib/rebalance-engine/drift'
import { optimizeScenarioTrades } from '@/lib/rebalance-engine/taxOptimizer'
import { buildTradeQueue, type QueueRow } from '@/lib/rebalance-engine/queue'
import type { EngineInput, EngineOutput, ScenarioType, TargetAllocation } from '@/lib/rebalance-engine/types'

function targetByScenario(targets: TargetAllocation[], scenario: ScenarioType): TargetAllocation {
  return targets.find((t) => t.scenario_type === scenario) || targets[0]
}

export function runRebalanceEngine(input: EngineInput): EngineOutput {
  const snapshot = buildPortfolioSnapshot(input.holdings, input.total_value)
  const targets = buildTargets(snapshot, input.policy)
  const moderateTarget = targetByScenario(targets, 'moderate')

  const drift = detectDrift({
    snapshot,
    target: moderateTarget,
    mode: input.mode,
    thresholdPct: input.threshold_pct ?? 5,
    nowIso: input.now_iso,
    lastRebalanceAt: input.last_rebalance_at,
  })

  const queuesByScenario: QueueRow[] = (['conservative', 'moderate', 'aggressive'] as const).flatMap((scenario) => {
    const target = targetByScenario(targets, scenario)
    const trades = optimizeScenarioTrades({
      scenario,
      snapshot,
      target,
      availableContributionCash: input.available_contribution_cash,
    })
    return buildTradeQueue(trades)
  })

  return {
    snapshot,
    drift,
    targets,
    trade_queue: queuesByScenario,
    diagnostics: {
      mode: input.mode,
      threshold_pct: input.threshold_pct ?? 5,
      available_contribution_cash: input.available_contribution_cash,
      last_rebalance_at: input.last_rebalance_at || null,
    },
  }
}

