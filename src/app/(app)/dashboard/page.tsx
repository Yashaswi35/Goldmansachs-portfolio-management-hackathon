import { createClient } from '@/lib/supabase/server'
import { getQuotes } from '@/lib/market-data/yahoo'
import { DashboardClient } from './dashboard-client'
import type { HoldingWithPrice } from '@/types'

function normalizeSector(rawSector: string | null | undefined, assetType?: string | null): string {
  if (rawSector && rawSector.trim().length > 0) return rawSector.trim()
  if (assetType === 'etf') return 'Diversified'
  if (assetType === 'bond') return 'Fixed Income'
  if (assetType === 'crypto') return 'Digital Assets'
  return 'Other'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, portfolioRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('portfolios').select('*, holdings(*)').eq('user_id', user.id).maybeSingle(),
  ])

  const profile = profileRes.data
  const portfolio = portfolioRes.data
  const holdings = portfolio?.holdings || []

  let holdingsWithPrices: HoldingWithPrice[] = []
  let totalValue = 0
  let totalCost = 0

  if (holdings.length > 0) {
    const tickers = holdings.map((h: { ticker: string }) => h.ticker)
    const quotes = await getQuotes(tickers)

    holdingsWithPrices = holdings.map((h: { ticker: string; shares: number; avg_cost_basis: number; company_name?: string; sector?: string; asset_type?: string; purchase_date?: string; id: string; portfolio_id: string; created_at: string }) => {
      const quote = quotes[h.ticker.toUpperCase()]
      const current_price = quote?.current_price ?? h.avg_cost_basis
      const current_value = current_price * h.shares
      const cost = h.avg_cost_basis * h.shares
      totalValue += current_value
      totalCost += cost
      return {
        ...h,
        current_price,
        daily_change_pct: quote?.daily_change_pct ?? 0,
        current_value,
        gain_loss: current_value - cost,
        gain_loss_pct: ((current_price - h.avg_cost_basis) / h.avg_cost_basis) * 100,
        allocation_pct: 0,
        asset_type: h.asset_type || 'stock',
        sector: normalizeSector(quote?.sector ?? h.sector, h.asset_type),
      }
    })

    holdingsWithPrices.forEach((h) => {
      h.allocation_pct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
    })
  }

  const totalGainLoss = totalValue - totalCost
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  return (
    <DashboardClient
      profile={profile}
      portfolio={portfolio}
      holdings={holdingsWithPrices}
      totalValue={totalValue}
      totalGainLoss={totalGainLoss}
      totalGainLossPct={totalGainLossPct}
    />
  )
}
