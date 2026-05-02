import type { EngineHolding } from '@/lib/rebalance-engine/types'
import type { PersonalizedPolicy } from '@/lib/personalization/policy'

export const policyFixture: PersonalizedPolicy = {
  risk_bucket: 'moderate',
  target_stock_min_pct: 55,
  target_stock_max_pct: 70,
  target_bond_min_pct: 20,
  target_bond_max_pct: 40,
  max_single_position_pct: 20,
  max_sector_pct: 35,
  profile_fingerprint: 'fixture',
}

export const holdingsFixture: EngineHolding[] = [
  {
    id: 'h1',
    ticker: 'AAPL',
    company_name: 'Apple',
    asset_type: 'stock',
    sector: 'Technology',
    shares: 10,
    avg_cost_basis: 100,
    current_price: 200,
    current_value: 2000,
    current_pct: 40,
    lots: [
      { id: 'l1', holding_id: 'h1', ticker: 'AAPL', acquired_at: '2024-01-10', shares_remaining: 5, cost_basis_per_share: 250 },
      { id: 'l2', holding_id: 'h1', ticker: 'AAPL', acquired_at: '2023-02-10', shares_remaining: 5, cost_basis_per_share: 90 },
    ],
  },
  {
    id: 'h2',
    ticker: 'MSFT',
    company_name: 'Microsoft',
    asset_type: 'stock',
    sector: 'Technology',
    shares: 6,
    avg_cost_basis: 200,
    current_price: 300,
    current_value: 1800,
    current_pct: 36,
    lots: [],
  },
  {
    id: 'h3',
    ticker: 'BND',
    company_name: 'Vanguard Total Bond',
    asset_type: 'bond',
    sector: 'Fixed Income',
    shares: 12,
    avg_cost_basis: 80,
    current_price: 100,
    current_value: 1200,
    current_pct: 24,
    lots: [],
  },
]

