// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinanceClass = require('yahoo-finance2').default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance: any = new YahooFinanceClass({ suppressNotices: ['yahooSurvey'] })
import type { MarketQuote } from '@/types'

const cache = new Map<string, { data: unknown; ts: number }>()
const TTL = 60_000
const API_TIMEOUT_MS = 4500

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ])
}

async function mapWithConcurrency<T>(
  items: string[],
  worker: (item: string) => Promise<T>,
  limit = 5
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })
  await Promise.allSettled(runners)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(v: any): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null
}

export async function getQuote(ticker: string): Promise<MarketQuote | null> {
  const key = `quote:${ticker.toUpperCase()}`
  const cached = getCached<MarketQuote>(key)
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await withTimeout(yahooFinance.quote(ticker.toUpperCase()))
    if (!result) return null

    const quote: MarketQuote = {
      ticker: result.symbol ?? ticker,
      company_name: result.longName || result.shortName || result.symbol || ticker,
      current_price: safeNum(result.regularMarketPrice) ?? 0,
      daily_change: safeNum(result.regularMarketChange) ?? 0,
      daily_change_pct: safeNum(result.regularMarketChangePercent) ?? 0,
      market_cap: safeNum(result.marketCap),
      sector: result.sector ?? null,
      pe_ratio: safeNum(result.trailingPE),
      fifty_two_week_high: safeNum(result.fiftyTwoWeekHigh),
      fifty_two_week_low: safeNum(result.fiftyTwoWeekLow),
    }

    setCache(key, quote)
    return quote
  } catch {
    return null
  }
}

export async function getQuotes(tickers: string[]): Promise<Record<string, MarketQuote>> {
  const results: Record<string, MarketQuote> = {}
  const uniqueTickers = Array.from(new Set(tickers.map((t) => t.toUpperCase())))

  await mapWithConcurrency(uniqueTickers, async (ticker) => {
    const quote = await getQuote(ticker)
    if (quote) results[ticker] = quote
  }, 6)

  return results
}

export interface MarketFundamentals {
  ticker: string
  sector: string | null
  industry: string | null
  market_cap: number | null
  pe_ratio: number | null
  forward_pe: number | null
  beta: number | null
  dividend_yield_pct: number | null
  avg_volume: number | null
  recommendation: string | null
  target_mean_price: number | null
  profit_margin_pct: number | null
  revenue_growth_pct: number | null
  earnings_growth_pct: number | null
  debt_to_equity: number | null
  return_on_equity_pct: number | null
  fifty_two_week_high: number | null
  fifty_two_week_low: number | null
}

export interface PriceHistoryPoint {
  date: string
  close: number
}

export interface MarketHeadline {
  ticker: string
  title: string
  url: string
  publisher: string | null
  published_at: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickNum(...values: any[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && isFinite(value)) return value
    if (value && typeof value.raw === 'number' && isFinite(value.raw)) return value.raw
  }
  return null
}

export async function getFundamentals(ticker: string): Promise<MarketFundamentals | null> {
  const symbol = ticker.toUpperCase()
  const key = `fundamentals:${symbol}`
  const cached = getCached<MarketFundamentals>(key)
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await withTimeout(
      yahooFinance.quoteSummary(symbol, {
        modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics', 'financialData'],
      }),
      3500
    )
    if (!summary) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetProfile: any = summary.assetProfile || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail: any = summary.summaryDetail || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats: any = summary.defaultKeyStatistics || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const financial: any = summary.financialData || {}

    const fundamentals: MarketFundamentals = {
      ticker: symbol,
      sector: assetProfile.sector || null,
      industry: assetProfile.industry || null,
      market_cap: pickNum(detail.marketCap, stats.marketCap),
      pe_ratio: pickNum(detail.trailingPE, stats.trailingPE),
      forward_pe: pickNum(detail.forwardPE, stats.forwardPE),
      beta: pickNum(detail.beta, stats.beta),
      dividend_yield_pct: (() => {
        const raw = pickNum(detail.dividendYield, stats.dividendYield)
        return raw === null ? null : raw * 100
      })(),
      avg_volume: pickNum(detail.averageVolume, detail.averageVolume10days, stats.averageDailyVolume10Day),
      recommendation: financial.recommendationKey || null,
      target_mean_price: pickNum(financial.targetMeanPrice),
      profit_margin_pct: (() => {
        const raw = pickNum(financial.profitMargins)
        return raw === null ? null : raw * 100
      })(),
      revenue_growth_pct: (() => {
        const raw = pickNum(financial.revenueGrowth)
        return raw === null ? null : raw * 100
      })(),
      earnings_growth_pct: (() => {
        const raw = pickNum(financial.earningsGrowth)
        return raw === null ? null : raw * 100
      })(),
      debt_to_equity: pickNum(financial.debtToEquity),
      return_on_equity_pct: (() => {
        const raw = pickNum(financial.returnOnEquity)
        return raw === null ? null : raw * 100
      })(),
      fifty_two_week_high: pickNum(detail.fiftyTwoWeekHigh),
      fifty_two_week_low: pickNum(detail.fiftyTwoWeekLow),
    }

    setCache(key, fundamentals)
    return fundamentals
  } catch {
    return null
  }
}

export async function getFundamentalsForTickers(tickers: string[]): Promise<Record<string, MarketFundamentals>> {
  const results: Record<string, MarketFundamentals> = {}
  const uniqueTickers = Array.from(new Set(tickers.map((t) => t.toUpperCase())))

  await mapWithConcurrency(uniqueTickers, async (ticker) => {
    const fundamentals = await getFundamentals(ticker)
    if (fundamentals) results[ticker] = fundamentals
  }, 3)

  return results
}

export async function getPriceHistory(ticker: string, period: '1mo' | '3mo' | '6mo' | '1y' = '3mo'): Promise<PriceHistoryPoint[]> {
  const symbol = ticker.toUpperCase()
  const key = `history:${symbol}:${period}`
  const cached = getCached<PriceHistoryPoint[]>(key)
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chart: any = await withTimeout(yahooFinance.chart(symbol, { range: period, interval: '1d' }), 3500)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (chart?.quotes || []).map((p: any) => {
      const dateObj = p?.date ? new Date(p.date) : null
      const close = safeNum(p?.close)
      if (!dateObj || close === null) return null
      return { date: dateObj.toISOString().slice(0, 10), close }
    }).filter(Boolean) as PriceHistoryPoint[]

    if (points.length > 0) {
      setCache(key, points)
      return points
    }
  } catch {
    // fallback below
  }

  try {
    const now = new Date()
    const days = period === '1mo' ? 35 : period === '3mo' ? 100 : period === '6mo' ? 190 : 380
    const period1 = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historical: any[] = await withTimeout(
      yahooFinance.historical(symbol, { period1, period2: now, interval: '1d' }),
      3500
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = (historical || []).map((p: any) => {
      const dateObj = p?.date ? new Date(p.date) : null
      const close = safeNum(p?.close)
      if (!dateObj || close === null) return null
      return { date: dateObj.toISOString().slice(0, 10), close }
    }).filter(Boolean) as PriceHistoryPoint[]

    setCache(key, points)
    return points
  } catch {
    return []
  }
}

export async function searchTickers(query: string): Promise<Array<{ ticker: string; name: string; type: string; exchange: string }>> {
  const key = `search:${query.toLowerCase()}`
  const cached = getCached<Array<{ ticker: string; name: string; type: string; exchange: string }>>(key)
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any = await withTimeout(yahooFinance.search(query), 3000)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type YahooQuoteResult = { quoteType?: string; symbol?: string; longname?: string; shortname?: string; exchDisp?: string; exchange?: string }
    const mapped = (results?.quotes || []).filter((r: YahooQuoteResult) =>
      r.quoteType === 'EQUITY' || r.quoteType === 'ETF'
    ).slice(0, 8).map((r: YahooQuoteResult) => ({
      ticker: r.symbol || '',
      name: r.longname || r.shortname || r.symbol || '',
      type: r.quoteType || 'EQUITY',
      exchange: r.exchDisp || r.exchange || '',
    }))

    setCache(key, mapped)
    return mapped
  } catch {
    return []
  }
}

export async function getNewsForTickers(tickers: string[], perTicker = 2): Promise<MarketHeadline[]> {
  const uniqueTickers = Array.from(new Set(tickers.map((t) => t.toUpperCase()))).slice(0, 8)
  const allHeadlines: MarketHeadline[] = []

  await mapWithConcurrency(uniqueTickers, async (ticker) => {
    const key = `news:${ticker}`
    const cached = getCached<MarketHeadline[]>(key)
    if (cached) {
      allHeadlines.push(...cached.slice(0, perTicker))
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchResult: any = await withTimeout(yahooFinance.search(ticker), 3500)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newsItems = Array.isArray(searchResult?.news) ? searchResult.news as any[] : []
      const mapped = newsItems.slice(0, perTicker).map((item) => {
        const publishedAt = typeof item?.providerPublishTime === 'number'
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : null
        return {
          ticker,
          title: item?.title || `Latest update on ${ticker}`,
          url: item?.link || item?.canonicalUrl?.url || '',
          publisher: item?.publisher || null,
          published_at: publishedAt,
        } as MarketHeadline
      }).filter((item) => item.url.length > 0)

      setCache(key, mapped)
      allHeadlines.push(...mapped)
    } catch {
      // Silent fallback: some tickers may not have fresh feed items.
    }
  }, 4)

  return allHeadlines
}
