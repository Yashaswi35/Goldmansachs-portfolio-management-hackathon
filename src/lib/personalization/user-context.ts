import type { HoldingWithPrice, Profile } from '@/types'
import { getFundamentalsForTickers, getQuotes } from '@/lib/market-data/yahoo'
import { buildPersonalizedPolicy } from '@/lib/personalization/policy'
import { buildIspPayload } from '@/lib/personalization/risk-ranking'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbHolding = {
  id: string
  portfolio_id: string
  ticker: string
  company_name: string | null
  shares: number
  avg_cost_basis: number
  asset_type: string | null
  sector: string | null
  purchase_date: string | null
  created_at: string
}

type DbPortfolio = {
  id: string
  name: string
  available_contribution_cash?: number | null
}

export type UserAiContext = {
  user_id: string
  portfolio_id: string | null
  portfolio_name: string | null
  profile: Profile | null
  policy: ReturnType<typeof buildPersonalizedPolicy>
  total_value: number
  holdings: HoldingWithPrice[]
  holdings_snapshot: Array<{
    id: string
    ticker: string
    company: string
    asset_type: string
    sector: string
    shares: number
    avg_cost_basis: number
    current_price: number
    current_value: number
    allocation_pct: number
    gain_loss_pct: number
    daily_change_pct: number
  }>
  available_contribution_cash: number
  market_context: { fed_rate: number; inflation: number; market_phase: string }
  ips_payload: ReturnType<typeof buildIspPayload>
  updated_at: string
}

function fingerprintProfile(profile: Profile | null): string {
  if (!profile) return 'none'
  return [
    profile.age,
    profile.risk_tolerance,
    profile.risk_archetype,
    profile.investment_goal,
    profile.investment_horizon,
    profile.annual_income,
    profile.employment_type,
    profile.num_dependents,
    profile.emergency_fund,
    profile.debt_type,
    profile.experience_level,
    profile.tax_bracket,
    profile.target_stock_pct,
    profile.target_bond_pct,
    profile.target_cash_pct,
  ].join('|')
}

function fingerprintHoldings(holdings: DbHolding[]): string {
  return holdings
    .map((h) => `${h.id}:${h.ticker}:${h.shares}:${h.avg_cost_basis}:${h.asset_type || ''}:${h.sector || ''}`)
    .sort()
    .join('|')
}

function toTypedHoldingSnapshots(holdings: DbHolding[], quotes: Awaited<ReturnType<typeof getQuotes>>, fundamentals: Awaited<ReturnType<typeof getFundamentalsForTickers>>) {
  let totalValue = 0
  const firstPass = holdings.map((h) => {
    const symbol = h.ticker.toUpperCase()
    const q = quotes[symbol]
    const f = fundamentals[symbol]
    const currentPrice = q?.current_price ?? h.avg_cost_basis
    const currentValue = currentPrice * h.shares
    totalValue += currentValue
    const gainLossPct = h.avg_cost_basis > 0 ? ((currentPrice - h.avg_cost_basis) / h.avg_cost_basis) * 100 : 0

    return {
      id: h.id,
      portfolio_id: h.portfolio_id,
      ticker: h.ticker,
      company_name: h.company_name,
      shares: h.shares,
      avg_cost_basis: h.avg_cost_basis,
      purchase_date: h.purchase_date,
      asset_type: (h.asset_type || 'stock') as HoldingWithPrice['asset_type'],
      sector: h.sector || f?.sector || q?.sector || 'Unknown',
      created_at: h.created_at,
      current_price: currentPrice,
      daily_change_pct: q?.daily_change_pct ?? 0,
      current_value: currentValue,
      gain_loss: currentValue - h.avg_cost_basis * h.shares,
      gain_loss_pct: gainLossPct,
      allocation_pct: 0,
    } as HoldingWithPrice
  })

  firstPass.forEach((h) => {
    h.allocation_pct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
  })
  return { holdingsWithPrice: firstPass, totalValue }
}

export async function getOrBuildUserAiContext(input: {
  supabase: SupabaseClient
  userId: string
  portfolioId?: string | null
  forceRefresh?: boolean
}): Promise<UserAiContext> {
  const { supabase, userId } = input
  const forceRefresh = input.forceRefresh === true
  const requestedPortfolioId = input.portfolioId || null

  const profileRes = await supabase.from('profiles').select('*').eq('id', userId).single()
  const profile = (profileRes.data || null) as Profile | null

  const portfolioRes = requestedPortfolioId
    ? await supabase.from('portfolios').select('id, name, available_contribution_cash').eq('id', requestedPortfolioId).eq('user_id', userId).maybeSingle()
    : await supabase.from('portfolios').select('id, name, available_contribution_cash').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle()
  const portfolio = (portfolioRes.data || null) as DbPortfolio | null
  const portfolioId = portfolio?.id || null

  const holdingsRes = portfolioId
    ? await supabase.from('holdings').select('*').eq('portfolio_id', portfolioId)
    : { data: [] as DbHolding[] }
  const holdings = (holdingsRes.data || []) as DbHolding[]

  const profileFp = fingerprintProfile(profile)
  const holdingsFp = fingerprintHoldings(holdings)

  if (!forceRefresh) {
    const cached = await supabase.from('user_ai_contexts').select('*').eq('user_id', userId).maybeSingle()
    const row = cached.data as { profile_fingerprint: string; holdings_fingerprint: string; context_json: UserAiContext } | null
    if (row && row.profile_fingerprint === profileFp && row.holdings_fingerprint === holdingsFp) {
      return row.context_json
    }
  }

  const tickers = holdings.map((h) => h.ticker.toUpperCase())
  const [quotes, fundamentals] = await Promise.all([
    tickers.length ? getQuotes(tickers) : Promise.resolve({}),
    tickers.length ? getFundamentalsForTickers(tickers) : Promise.resolve({}),
  ])

  const { holdingsWithPrice, totalValue } = toTypedHoldingSnapshots(holdings, quotes, fundamentals)
  const policy = buildPersonalizedPolicy(profile)

  const holdings_snapshot = holdingsWithPrice.map((h) => ({
    id: h.id,
    ticker: h.ticker,
    company: h.company_name || h.ticker,
    asset_type: h.asset_type,
    sector: h.sector || 'Unknown',
    shares: h.shares,
    avg_cost_basis: h.avg_cost_basis,
    current_price: Number(h.current_price.toFixed(4)),
    current_value: Number(h.current_value.toFixed(2)),
    allocation_pct: Number(h.allocation_pct.toFixed(4)),
    gain_loss_pct: Number(h.gain_loss_pct.toFixed(4)),
    daily_change_pct: Number(h.daily_change_pct.toFixed(4)),
  }))

  const context: UserAiContext = {
    user_id: userId,
    portfolio_id: portfolioId,
    portfolio_name: portfolio?.name || null,
    profile,
    policy,
    total_value: Number(totalValue.toFixed(2)),
    holdings: holdingsWithPrice,
    holdings_snapshot,
    available_contribution_cash: Math.max(0, Number(portfolio?.available_contribution_cash || 0)),
    market_context: { fed_rate: 5.25, inflation: 3.2, market_phase: 'late_cycle' },
    ips_payload: buildIspPayload({ profile, holdings: holdingsWithPrice, marketContext: { fed_rate: 5.25, inflation: 3.2, market_phase: 'late_cycle' } }),
    updated_at: new Date().toISOString(),
  }

  await supabase.from('user_ai_contexts').upsert({
    user_id: userId,
    portfolio_id: portfolioId,
    profile_fingerprint: profileFp,
    holdings_fingerprint: holdingsFp,
    context_json: context,
    updated_at: context.updated_at,
  })

  return context
}

