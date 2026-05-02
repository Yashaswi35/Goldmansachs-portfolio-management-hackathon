import type { PersonalizedPolicy } from '@/lib/personalization/policy'
import type { EngineHolding, PortfolioSnapshot, ScenarioType, TargetAllocation } from '@/lib/rebalance-engine/types'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function classTarget(policy: PersonalizedPolicy, scenario: ScenarioType): { stock: number; bond: number; cash: number } {
  const stockMid = (policy.target_stock_min_pct + policy.target_stock_max_pct) / 2
  const stock = scenario === 'conservative'
    ? policy.target_stock_min_pct
    : scenario === 'aggressive'
      ? policy.target_stock_max_pct
      : stockMid
  const bondTarget = clamp(100 - stock, policy.target_bond_min_pct, policy.target_bond_max_pct)
  const cash = Math.max(0, 100 - stock - bondTarget)
  return { stock, bond: bondTarget, cash }
}

function splitByAssetClass(holdings: EngineHolding[]) {
  const stock = holdings.filter((h) => h.asset_type !== 'bond')
  const bond = holdings.filter((h) => h.asset_type === 'bond')
  return { stock, bond }
}

function distributeClassTarget(holdings: EngineHolding[], classTargetPct: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (holdings.length === 0 || classTargetPct <= 0) return out

  const currentClassPct = holdings.reduce((sum, h) => sum + h.current_pct, 0)
  if (currentClassPct > 0) {
    holdings.forEach((h) => {
      out[h.ticker] = classTargetPct * (h.current_pct / currentClassPct)
    })
    return out
  }

  const equal = classTargetPct / holdings.length
  holdings.forEach((h) => { out[h.ticker] = equal })
  return out
}

function enforceSectorCap(
  target: Record<string, number>,
  holdings: EngineHolding[],
  sectorCap: number
): Record<string, number> {
  const byTicker = { ...target }
  const bySectorTickers: Record<string, string[]> = {}
  holdings.forEach((h) => {
    bySectorTickers[h.sector] = bySectorTickers[h.sector] || []
    bySectorTickers[h.sector].push(h.ticker)
  })

  let excess = 0
  Object.entries(bySectorTickers).forEach(([, tickers]) => {
    const sectorTarget = tickers.reduce((sum, t) => sum + (byTicker[t] || 0), 0)
    if (sectorTarget > sectorCap) {
      const over = sectorTarget - sectorCap
      excess += over
      const ratio = sectorCap / sectorTarget
      tickers.forEach((t) => { byTicker[t] = (byTicker[t] || 0) * ratio })
    }
  })

  if (excess > 0) {
    const candidates = holdings
      .map((h) => h.ticker)
      .filter((t) => (byTicker[t] || 0) > 0)
    const each = candidates.length > 0 ? excess / candidates.length : 0
    candidates.forEach((t) => { byTicker[t] = (byTicker[t] || 0) + each })
  }

  return byTicker
}

export function buildTargets(snapshot: PortfolioSnapshot, policy: PersonalizedPolicy): TargetAllocation[] {
  const scenarios: ScenarioType[] = ['conservative', 'moderate', 'aggressive']
  const { stock, bond } = splitByAssetClass(snapshot.holdings)

  return scenarios.map((scenario_type) => {
    const classMix = classTarget(policy, scenario_type)
    const stockTargets = distributeClassTarget(stock, classMix.stock)
    const bondTargets = distributeClassTarget(bond, classMix.bond)
    const merged = { ...stockTargets, ...bondTargets }
    const sectorCapped = enforceSectorCap(merged, snapshot.holdings, policy.max_sector_pct)

    return {
      scenario_type,
      target_stock_pct: classMix.stock,
      target_bond_pct: classMix.bond,
      target_cash_pct: classMix.cash,
      by_ticker_target_pct: sectorCapped,
    }
  })
}

