import { NextRequest, NextResponse } from 'next/server'
import { searchTickers } from '@/lib/market-data/yahoo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 1) {
    return NextResponse.json([])
  }

  const results = await searchTickers(q)
  return NextResponse.json(results)
}
