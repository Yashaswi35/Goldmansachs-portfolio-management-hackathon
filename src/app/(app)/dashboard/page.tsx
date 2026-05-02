import { createClient } from '@/lib/supabase/server'
import { getFundamentalsForTickers, getQuotes } from '@/lib/market-data/yahoo'
import { DashboardMainClient } from './dashboard-main-client'
import type { HoldingWithPrice } from '@/types'
import { redirect } from 'next/navigation'

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

function normalizeSectorName(rawSector: string | null | undefined): string | null {
  if (!rawSector || rawSector.trim().length === 0) return null
  const cleaned = rawSector.trim()
  const byKey: Record<string, string> = {
    'Consumer Cyclical': 'Consumer Discretionary',
    'Consumer Defensive': 'Consumer Staples',
    'Basic Materials': 'Materials',
    'Communication': 'Communication Services',
  }
  return byKey[cleaned] || cleaned
}

function inferSectorFromSymbolOrName(ticker: string, companyName: string | null | undefined, assetType?: string | null): string | null {
  if (assetType === 'etf') return 'Diversified'
  if (assetType === 'bond') return 'Fixed Income'
  if (assetType === 'crypto') return 'Digital Assets'

  const symbol = ticker.toUpperCase()
  const name = (companyName || '').toLowerCase()

  if (['AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'META', 'ORCL', 'ADBE', 'CRM', 'INTC'].includes(symbol)) return 'Technology'
  if (['JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP'].includes(symbol)) return 'Financials'
  if (['JNJ', 'PFE', 'UNH', 'LLY', 'MRK'].includes(symbol)) return 'Healthcare'
  if (['DE', 'CAT', 'GE', 'BA', 'HON', 'UNP'].includes(symbol)) return 'Industrials'
  if (['XOM', 'CVX', 'COP', 'SLB'].includes(symbol)) return 'Energy'
  if (['KO', 'PEP', 'PG', 'WMT', 'COST'].includes(symbol)) return 'Consumer Staples'

  if (name.includes('bank') || name.includes('financial')) return 'Financials'
  if (name.includes('pharma') || name.includes('health') || name.includes('medical') || name.includes('biotech')) return 'Healthcare'
  if (name.includes('energy') || name.includes('petroleum') || name.includes('oil')) return 'Energy'
  if (name.includes('industrial') || name.includes('machinery') || name.includes('equipment') || name.includes('tractor')) return 'Industrials'
  if (name.includes('software') || name.includes('semiconductor') || name.includes('technology') || name.includes('tech')) return 'Technology'

  return null
}

function resolveSector(input: {
  ticker: string
  companyName?: string | null
  fundamentalSector?: string | null
  quoteSector?: string | null
  storedSector?: string | null
  assetType?: string | null
}): string {
  const fromFundamentals = normalizeSectorName(input.fundamentalSector)
  if (fromFundamentals) return fromFundamentals

  const fromQuote = normalizeSectorName(input.quoteSector)
  if (fromQuote) return fromQuote

  const fromStored = normalizeSectorName(input.storedSector)
  if (fromStored) return fromStored

  const inferred = inferSectorFromSymbolOrName(input.ticker, input.companyName, input.assetType)
  if (inferred) return inferred

  if (input.assetType === 'etf') return 'Diversified'
  if (input.assetType === 'bond') return 'Fixed Income'
  if (input.assetType === 'crypto') return 'Digital Assets'
  return 'Other'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

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
    const [quotesAttempt, fundamentalsAttempt] = await Promise.all([
      withTimeout(getQuotes(tickers), 1800, {}),
      withTimeout(getFundamentalsForTickers(tickers), 1200, {}),
    ])
    const quotes = Object.keys(quotesAttempt).length > 0
      ? quotesAttempt
      : await withTimeout(getQuotes(tickers), 4500, {})
    const fundamentalsByTicker = Object.keys(fundamentalsAttempt).length > 0
      ? fundamentalsAttempt
      : await withTimeout(getFundamentalsForTickers(tickers), 3500, {})

    holdingsWithPrices = holdings.map((h: { ticker: string; shares: number; avg_cost_basis: number; company_name?: string; sector?: string; asset_type?: string; purchase_date?: string; id: string; portfolio_id: string; created_at: string }) => {
      const quote = quotes[h.ticker.toUpperCase()]
      const fundamentals = fundamentalsByTicker[h.ticker.toUpperCase()]
      const current_price = quote?.current_price ?? h.avg_cost_basis
      const current_value = current_price * h.shares
      const cost = h.avg_cost_basis * h.shares
      totalValue += current_value
      totalCost += cost
      const safeCostBasis = h.avg_cost_basis > 0 ? h.avg_cost_basis : current_price
      return {
        ...h,
        current_price,
        daily_change_pct: quote?.daily_change_pct ?? 0,
        current_value,
        gain_loss: current_value - cost,
        gain_loss_pct: safeCostBasis > 0 ? ((current_price - safeCostBasis) / safeCostBasis) * 100 : 0,
        allocation_pct: 0,
        asset_type: h.asset_type || 'stock',
        sector: resolveSector({
          ticker: h.ticker,
          companyName: h.company_name,
          fundamentalSector: fundamentals?.sector,
          quoteSector: quote?.sector,
          storedSector: h.sector,
          assetType: h.asset_type,
        }),
      }
    })

    holdingsWithPrices.forEach((h) => {
      h.allocation_pct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0
    })
  }

  const totalGainLoss = totalValue - totalCost
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0

  return (
    <DashboardMainClient
      profile={profile}
      portfolio={portfolio}
      holdings={holdingsWithPrices}
      totalValue={totalValue}
      totalGainLoss={totalGainLoss}
      totalGainLossPct={totalGainLossPct}
    />
  )
}
