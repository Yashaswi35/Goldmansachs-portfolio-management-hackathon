import type { Profile } from '@/types'
import type { PersonalizedPolicy } from '@/lib/personalization/policy'

export type RebalanceMode = 'threshold' | 'calendar' | 'hybrid'
export type ScenarioType = 'conservative' | 'moderate' | 'aggressive'

export interface HoldingLot {
  id: string
  holding_id: string
  ticker: string
  acquired_at: string
  shares_remaining: number
  cost_basis_per_share: number
}

export interface EngineHolding {
  id: string
  ticker: string
  company_name: string
  asset_type: string
  sector: string
  shares: number
  avg_cost_basis: number
  current_price: number
  current_value: number
  current_pct: number
  lots: HoldingLot[]
}

export interface PortfolioSnapshot {
  total_value: number
  stock_pct: number
  bond_pct: number
  cash_pct: number
  holdings: EngineHolding[]
  sector_pct: Record<string, number>
}

export interface TargetAllocation {
  scenario_type: ScenarioType
  target_stock_pct: number
  target_bond_pct: number
  target_cash_pct: number
  by_ticker_target_pct: Record<string, number>
}

export interface DriftDiagnostic {
  by_ticker_drift_pct: Record<string, number>
  max_abs_drift_pct: number
  threshold_triggered: boolean
  calendar_triggered: boolean
  should_rebalance: boolean
  trigger_reason: string
}

export interface OptimizedTrade {
  scenario_type: ScenarioType
  ticker: string
  company_name: string
  action: 'buy' | 'sell' | 'hold'
  dollars: number
  shares_estimate: number
  current_pct: number
  target_pct: number
  impact_score: number
  reason: string
  explanation: string
  tax_note?: string
  lot_ids?: string[]
}

export interface EngineInput {
  mode: RebalanceMode
  profile: Profile | null
  policy: PersonalizedPolicy
  holdings: EngineHolding[]
  total_value: number
  available_contribution_cash: number
  threshold_pct?: number
  last_rebalance_at?: string | null
  now_iso?: string
}

export interface EngineOutput {
  snapshot: PortfolioSnapshot
  drift: DriftDiagnostic
  targets: TargetAllocation[]
  trade_queue: OptimizedTrade[]
  diagnostics: Record<string, unknown>
}

