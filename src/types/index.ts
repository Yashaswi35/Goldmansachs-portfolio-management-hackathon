export type EmploymentType = 'employed' | 'self-employed' | 'student' | 'retired' | 'unemployed'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
export type InvestmentGoal = 'retirement' | 'house' | 'emergency' | 'wealth' | 'education'
export type InvestmentHorizon = '<1yr' | '1-5yrs' | '5-10yrs' | '10+yrs'
export type AssetType = 'stock' | 'etf' | 'crypto' | 'bond'
export type ScenarioType = 'conservative' | 'moderate' | 'aggressive'

export type RiskArchetype = 'conservative' | 'moderately_conservative' | 'moderate' | 'moderately_aggressive' | 'aggressive'
export type EmergencyFund = 'none' | 'less_3mo' | '3_6mo' | '6mo_plus'
export type DebtType = 'none' | 'student_loans' | 'credit_cards' | 'mortgage' | 'multiple'
export type ExperienceLevel = 'total_beginner' | 'read_about_it' | 'traded_before' | 'experienced'
export type TaxBracket = 'under_44k' | '44_89k' | '89_190k' | '190k_plus'

export interface Profile {
  id: string
  full_name: string | null
  age: number | null
  annual_income: number | null
  employment_type: EmploymentType | null
  marital_status: MaritalStatus | null
  num_dependents: number
  risk_tolerance: RiskTolerance | null
  risk_archetype: RiskArchetype | null
  investment_goal: InvestmentGoal | null
  investment_horizon: InvestmentHorizon | null
  emergency_fund: EmergencyFund | null
  debt_type: DebtType | null
  experience_level: ExperienceLevel | null
  tax_bracket: TaxBracket | null
  has_near_term_expenses: boolean
  investment_policy_statement: string | null
  target_stock_pct: number | null
  target_bond_pct: number | null
  target_cash_pct: number | null
  onboarding_completed: boolean
  created_at: string
}

export interface Portfolio {
  id: string
  user_id: string
  name: string
  source: string
  created_at: string
}

export interface Holding {
  id: string
  portfolio_id: string
  ticker: string
  company_name: string | null
  shares: number
  avg_cost_basis: number
  purchase_date: string | null
  asset_type: AssetType
  sector: string | null
  created_at: string
}

export interface HoldingWithPrice extends Holding {
  current_price: number
  daily_change_pct: number
  current_value: number
  gain_loss: number
  gain_loss_pct: number
  allocation_pct: number
}

export interface RebalancingAction {
  ticker: string
  company_name: string
  action: 'buy' | 'sell' | 'hold'
  current_pct: number
  target_pct: number
  estimated_amount: number
  reason: string
  beginner_explanation: string
}

export interface RebalancingScenario {
  id?: string
  scenario_type: ScenarioType
  title: string
  tagline: string
  rationale: string
  expected_outcome: string
  risk_level: number
  strategy_basis: string
  actions: RebalancingAction[]
}

export interface PortfolioAnalysis {
  health_score: number
  risk_assessment: string
  top_risks: string[]
  insights: string[]
  sector_concentration: Record<string, number>
  suggested_additions: SuggestedInvestment[]
}

export interface SuggestedInvestment {
  ticker: string
  company_name: string
  reason: string
  asset_type: AssetType
  risk_level: number
}

export interface MarketQuote {
  ticker: string
  company_name: string
  current_price: number
  daily_change: number
  daily_change_pct: number
  market_cap: number | null
  sector: string | null
  pe_ratio: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
}
