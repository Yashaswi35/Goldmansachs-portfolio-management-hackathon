import type { EngineHolding, PortfolioSnapshot } from '@/lib/rebalance-engine/types'

function isBondLike(assetType: string): boolean {
  return assetType === 'bond'
}

export function buildPortfolioSnapshot(holdings: EngineHolding[], totalValueInput?: number): PortfolioSnapshot {
  const total_value = totalValueInput && totalValueInput > 0
    ? totalValueInput
    : holdings.reduce((sum, h) => sum + h.current_value, 0)

  if (total_value <= 0) {
    return {
      total_value: 0,
      stock_pct: 0,
      bond_pct: 0,
      cash_pct: 0,
      holdings,
      sector_pct: {},
    }
  }

  let stockValue = 0
  let bondValue = 0
  const sector_pct: Record<string, number> = {}

  const normalized = holdings.map((h) => {
    const current_pct = (h.current_value / total_value) * 100
    const sector = h.sector || (isBondLike(h.asset_type) ? 'Fixed Income' : 'Other')

    if (isBondLike(h.asset_type)) bondValue += h.current_value
    else stockValue += h.current_value

    sector_pct[sector] = (sector_pct[sector] || 0) + current_pct

    return { ...h, current_pct, sector }
  })

  const stock_pct = (stockValue / total_value) * 100
  const bond_pct = (bondValue / total_value) * 100
  const cash_pct = Math.max(0, 100 - stock_pct - bond_pct)

  return {
    total_value,
    stock_pct,
    bond_pct,
    cash_pct,
    holdings: normalized,
    sector_pct,
  }
}

