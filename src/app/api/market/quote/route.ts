import { NextRequest, NextResponse } from 'next/server'
import { getFundamentals, getQuote, getQuotes } from '@/lib/market-data/yahoo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')
  const tickers = searchParams.get('tickers')

  if (tickers) {
    const tickerList = tickers.split(',').map((t) => t.trim()).filter(Boolean)
    const quotes = await getQuotes(tickerList)
    return NextResponse.json(quotes)
  }

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  const quote = await getQuote(ticker)
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  if (!quote.sector) {
    const fundamentals = await getFundamentals(ticker)
    if (fundamentals?.sector) {
      return NextResponse.json({ ...quote, sector: fundamentals.sector })
    }
  }

  return NextResponse.json(quote)
}
