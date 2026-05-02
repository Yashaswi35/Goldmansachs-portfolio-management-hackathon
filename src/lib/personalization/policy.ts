import type { Profile } from '@/types'

type RiskBucket =
  | 'conservative'
  | 'moderately_conservative'
  | 'moderate'
  | 'moderately_aggressive'
  | 'aggressive'

export interface PersonalizedPolicy {
  risk_bucket: RiskBucket
  target_stock_min_pct: number
  target_stock_max_pct: number
  target_bond_min_pct: number
  target_bond_max_pct: number
  max_single_position_pct: number
  max_sector_pct: number
}

export interface PolicyDiagnostics {
  stock_pct: number
  bond_pct: number
  sector_concentration: Record<string, number>
  concentration_flags: string[]
}

export interface PolicyHolding {
  ticker: string
  current_value: number
  asset_type?: string | null
  sector?: string | null
}

function toBucket(profile: Profile | null): RiskBucket {
  if (profile?.risk_archetype) return profile.risk_archetype
  if (profile?.risk_tolerance === 'conservative') return 'conservative'
  if (profile?.risk_tolerance === 'aggressive') return 'aggressive'
  return 'moderate'
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function buildPersonalizedPolicy(profile: Profile | null): PersonalizedPolicy {
  const bucket = toBucket(profile)
  const base: Record<RiskBucket, { stockMin: number; stockMax: number; maxPos: number; maxSector: number }> = {
    conservative: { stockMin: 30, stockMax: 50, maxPos: 12, maxSector: 35 },
    moderately_conservative: { stockMin: 45, stockMax: 60, maxPos: 15, maxSector: 40 },
    moderate: { stockMin: 60, stockMax: 75, maxPos: 20, maxSector: 45 },
    moderately_aggressive: { stockMin: 72, stockMax: 88, maxPos: 24, maxSector: 50 },
    aggressive: { stockMin: 82, stockMax: 100, maxPos: 30, maxSector: 60 },
  }

  const rule = base[bucket]
  let stockMin = rule.stockMin
  let stockMax = rule.stockMax
  let maxPos = rule.maxPos
  let maxSector = rule.maxSector

  if (profile?.age && profile.age >= 60) {
    stockMin -= 8
    stockMax -= 10
    maxPos -= 2
    maxSector -= 4
  }
  if (profile?.has_near_term_expenses) {
    stockMin -= 8
    stockMax -= 10
    maxPos -= 2
    maxSector -= 4
  }
  if (profile?.emergency_fund === 'none' || profile?.emergency_fund === 'less_3mo') {
    stockMin -= 7
    stockMax -= 8
    maxPos -= 2
  }
  if (profile?.debt_type === 'credit_cards' || profile?.debt_type === 'multiple') {
    stockMin -= 6
    stockMax -= 8
    maxPos -= 2
  }
  if ((profile?.num_dependents || 0) >= 3) {
    stockMin -= 3
    stockMax -= 4
  }
  if (profile?.investment_horizon === '<1yr') {
    stockMin -= 20
    stockMax -= 25
    maxPos -= 4
    maxSector -= 8
  } else if (profile?.investment_horizon === '1-5yrs') {
    stockMin -= 10
    stockMax -= 12
    maxPos -= 2
    maxSector -= 5
  } else if (profile?.investment_horizon === '10+yrs' && bucket !== 'conservative') {
    stockMin += 3
    stockMax += 3
  }

  stockMin = clamp(stockMin, 15, 95)
  stockMax = clamp(Math.max(stockMax, stockMin + 8), stockMin + 8, 100)
  maxPos = clamp(maxPos, 8, 35)
  maxSector = clamp(maxSector, 25, 65)

  return {
    risk_bucket: bucket,
    target_stock_min_pct: stockMin,
    target_stock_max_pct: stockMax,
    target_bond_min_pct: clamp(100 - stockMax, 0, 85),
    target_bond_max_pct: clamp(100 - stockMin, 0, 85),
    max_single_position_pct: maxPos,
    max_sector_pct: maxSector,
  }
}

export function buildPolicyDiagnostics(holdings: PolicyHolding[], totalValue: number, policy: PersonalizedPolicy): PolicyDiagnostics {
  if (totalValue <= 0 || holdings.length === 0) {
    return { stock_pct: 0, bond_pct: 0, sector_concentration: {}, concentration_flags: [] }
  }

  let equityValue = 0
  let bondValue = 0
  const sector_concentration: Record<string, number> = {}
  const concentration_flags: string[] = []

  for (const h of holdings) {
    const value = h.current_value || 0
    const weight = (value / totalValue) * 100
    const assetType = h.asset_type || 'stock'
    const sector = h.sector || (assetType === 'bond' ? 'Fixed Income' : assetType === 'etf' ? 'Diversified' : 'Other')

    if (assetType === 'bond') bondValue += value
    else equityValue += value

    sector_concentration[sector] = (sector_concentration[sector] || 0) + weight

    if (weight > policy.max_single_position_pct) {
      concentration_flags.push(`${h.ticker} is ${weight.toFixed(1)}% of portfolio (max ${policy.max_single_position_pct}%)`)
    }
  }

  Object.entries(sector_concentration).forEach(([sector, pct]) => {
    if (pct > policy.max_sector_pct) {
      concentration_flags.push(`${sector} sector is ${pct.toFixed(1)}% (max ${policy.max_sector_pct}%)`)
    }
  })

  const stock_pct = (equityValue / totalValue) * 100
  const bond_pct = (bondValue / totalValue) * 100

  if (stock_pct < policy.target_stock_min_pct) {
    concentration_flags.push(`Equity allocation is low: ${stock_pct.toFixed(1)}% (target ${policy.target_stock_min_pct}-${policy.target_stock_max_pct}%)`)
  } else if (stock_pct > policy.target_stock_max_pct) {
    concentration_flags.push(`Equity allocation is high: ${stock_pct.toFixed(1)}% (target ${policy.target_stock_min_pct}-${policy.target_stock_max_pct}%)`)
  }

  return { stock_pct, bond_pct, sector_concentration, concentration_flags }
}

