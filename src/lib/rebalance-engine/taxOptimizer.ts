import type { EngineHolding, HoldingLot, OptimizedTrade, PortfolioSnapshot, ScenarioType, TargetAllocation } from '@/lib/rebalance-engine/types'

type SellPlan = { lotIds: string[]; shares: number; dollars: number; taxNote: string }

function sortLotsForSell(lots: HoldingLot[], currentPrice: number): HoldingLot[] {
  return [...lots].sort((a, b) => {
    const aPnlPct = a.cost_basis_per_share > 0 ? (currentPrice - a.cost_basis_per_share) / a.cost_basis_per_share : 0
    const bPnlPct = b.cost_basis_per_share > 0 ? (currentPrice - b.cost_basis_per_share) / b.cost_basis_per_share : 0
    if (aPnlPct !== bPnlPct) return aPnlPct - bPnlPct // harvest losses first
    return new Date(a.acquired_at).getTime() - new Date(b.acquired_at).getTime()
  })
}

function planSellLots(holding: EngineHolding, dollarsToSell: number): SellPlan {
  if (dollarsToSell <= 0 || holding.current_price <= 0) {
    return { lotIds: [], shares: 0, dollars: 0, taxNote: 'No sell required.' }
  }

  const sorted = sortLotsForSell(holding.lots || [], holding.current_price)
  let remaining = dollarsToSell
  let shares = 0
  const lotIds: string[] = []
  let harvestedLoss = false

  for (const lot of sorted) {
    if (remaining <= 0) break
    const lotDollarCap = lot.shares_remaining * holding.current_price
    if (lotDollarCap <= 0) continue
    const dollarTake = Math.min(remaining, lotDollarCap)
    const lotShares = dollarTake / holding.current_price
    shares += lotShares
    remaining -= dollarTake
    lotIds.push(lot.id)
    if (holding.current_price < lot.cost_basis_per_share) harvestedLoss = true
  }

  const dollars = shares * holding.current_price
  const taxNote = harvestedLoss
    ? 'Loss-harvest lots prioritized before gains.'
    : 'Lowest-gain lots selected to reduce realized taxes.'

  return { lotIds, shares, dollars, taxNote }
}

function actionReason(deltaPct: number, targetPct: number, currentPct: number): string {
  if (Math.abs(deltaPct) < 0.05) return 'Allocation is close to target; hold.'
  if (deltaPct > 0) return `Under target by ${(targetPct - currentPct).toFixed(2)}% — add gradually.`
  return `Over target by ${(currentPct - targetPct).toFixed(2)}% — trim risk and concentration.`
}

export function optimizeScenarioTrades(input: {
  scenario: ScenarioType
  snapshot: PortfolioSnapshot
  target: TargetAllocation
  availableContributionCash: number
}): OptimizedTrade[] {
  const { snapshot, target, scenario } = input
  const total = snapshot.total_value || 1
  const contributionPool = Math.max(0, input.availableContributionCash || 0)

  const base = snapshot.holdings.map((h) => {
    const targetPct = target.by_ticker_target_pct[h.ticker] || 0
    const deltaPct = targetPct - h.current_pct
    const rawDollars = Math.abs(deltaPct) * total / 100
    return { holding: h, targetPct, deltaPct, rawDollars }
  })

  const buys = base.filter((x) => x.deltaPct > 0.05).sort((a, b) => b.deltaPct - a.deltaPct)
  const sells = base.filter((x) => x.deltaPct < -0.05).sort((a, b) => a.deltaPct - b.deltaPct)
  const holds = base.filter((x) => Math.abs(x.deltaPct) <= 0.05)

  let contributionLeft = contributionPool
  const out: OptimizedTrade[] = []

  buys.forEach((b) => {
    const fromContribution = Math.min(contributionLeft, b.rawDollars)
    contributionLeft -= fromContribution
    const remainingDollars = Math.max(0, b.rawDollars - fromContribution)
    const shares = b.holding.current_price > 0 ? remainingDollars / b.holding.current_price : 0
    out.push({
      scenario_type: scenario,
      ticker: b.holding.ticker,
      company_name: b.holding.company_name,
      action: remainingDollars > 0 ? 'buy' : 'hold',
      dollars: Number(remainingDollars.toFixed(2)),
      shares_estimate: Number(shares.toFixed(6)),
      current_pct: Number(b.holding.current_pct.toFixed(3)),
      target_pct: Number(b.targetPct.toFixed(3)),
      impact_score: Math.abs(b.deltaPct),
      tax_note: fromContribution > 0 ? `Used ${fromContribution.toFixed(2)} from contributions before sells.` : undefined,
      reason: actionReason(b.deltaPct, b.targetPct, b.holding.current_pct),
      explanation: 'Uses contribution cash first to reduce taxable sells.',
    })
  })

  sells.forEach((s) => {
    const sellPlan = planSellLots(s.holding, s.rawDollars)
    out.push({
      scenario_type: scenario,
      ticker: s.holding.ticker,
      company_name: s.holding.company_name,
      action: sellPlan.dollars > 0 ? 'sell' : 'hold',
      dollars: Number(sellPlan.dollars.toFixed(2)),
      shares_estimate: Number(sellPlan.shares.toFixed(6)),
      current_pct: Number(s.holding.current_pct.toFixed(3)),
      target_pct: Number(s.targetPct.toFixed(3)),
      impact_score: Math.abs(s.deltaPct),
      tax_note: sellPlan.taxNote,
      reason: actionReason(s.deltaPct, s.targetPct, s.holding.current_pct),
      explanation: 'Loss-harvest and lower-gain lots are prioritized for tax efficiency.',
      lot_ids: sellPlan.lotIds,
    })
  })

  holds.slice(0, 2).forEach((h) => {
    out.push({
      scenario_type: scenario,
      ticker: h.holding.ticker,
      company_name: h.holding.company_name,
      action: 'hold',
      dollars: 0,
      shares_estimate: 0,
      current_pct: Number(h.holding.current_pct.toFixed(3)),
      target_pct: Number(h.targetPct.toFixed(3)),
      impact_score: 0,
      reason: actionReason(h.deltaPct, h.targetPct, h.holding.current_pct),
      explanation: 'Position is already near target allocation.',
    })
  })

  if (!out.some((t) => t.action === 'hold') && out.length > 0) {
    out[out.length - 1] = { ...out[out.length - 1], action: 'hold', dollars: 0, shares_estimate: 0 }
  }

  return out
}

