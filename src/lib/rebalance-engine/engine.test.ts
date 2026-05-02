import { describe, expect, it } from 'vitest'
import { buildPortfolioSnapshot } from '@/lib/rebalance-engine/snapshot'
import { buildTargets } from '@/lib/rebalance-engine/targets'
import { detectDrift } from '@/lib/rebalance-engine/drift'
import { optimizeScenarioTrades } from '@/lib/rebalance-engine/taxOptimizer'
import { buildTradeQueue } from '@/lib/rebalance-engine/queue'
import { holdingsFixture, policyFixture } from '@/lib/rebalance-engine/__tests__/fixtures'

describe('rebalance engine', () => {
  it('builds target allocations for all scenarios', () => {
    const snapshot = buildPortfolioSnapshot(holdingsFixture, 5000)
    const targets = buildTargets(snapshot, policyFixture)
    expect(targets).toHaveLength(3)
    expect(targets.find((t) => t.scenario_type === 'conservative')?.target_stock_pct).toBe(55)
    expect(targets.find((t) => t.scenario_type === 'aggressive')?.target_stock_pct).toBe(70)
  })

  it('detects threshold drift trigger', () => {
    const snapshot = buildPortfolioSnapshot(holdingsFixture, 5000)
    const target = buildTargets(snapshot, policyFixture).find((t) => t.scenario_type === 'moderate')!
    const drift = detectDrift({
      snapshot,
      target,
      mode: 'threshold',
      thresholdPct: 5,
      nowIso: '2026-01-01T00:00:00.000Z',
      lastRebalanceAt: '2025-12-20T00:00:00.000Z',
    })
    expect(drift.threshold_triggered).toBe(true)
    expect(drift.should_rebalance).toBe(true)
  })

  it('prioritizes loss lots and ranks queue rows', () => {
    const snapshot = buildPortfolioSnapshot(holdingsFixture, 5000)
    const moderate = buildTargets(snapshot, policyFixture).find((t) => t.scenario_type === 'moderate')!
    const optimized = optimizeScenarioTrades({
      scenario: 'moderate',
      snapshot,
      target: moderate,
      availableContributionCash: 200,
    })
    const queue = buildTradeQueue(optimized)
    expect(queue.length).toBeGreaterThan(0)
    const sell = queue.find((q) => q.action === 'sell' && q.ticker === 'AAPL')
    if (sell) {
      expect(sell.lot_ids?.[0]).toBe('l1')
    }
    for (let i = 1; i < queue.length; i += 1) {
      expect(queue[i - 1].impact_score).toBeGreaterThanOrEqual(queue[i].impact_score)
    }
  })
})

