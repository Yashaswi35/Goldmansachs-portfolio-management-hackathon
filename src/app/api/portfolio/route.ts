import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('*, holdings(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return NextResponse.json(portfolios || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  if (action === 'add_holding') {
    const { portfolio_id, ticker, company_name, shares, avg_cost_basis, purchase_date, asset_type, sector } = body

    const { data: holding, error } = await supabase
      .from('holdings')
      .insert({ portfolio_id, ticker: ticker.toUpperCase(), company_name, shares, avg_cost_basis, purchase_date, asset_type: asset_type || 'stock', sector })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(holding)
  }

  if (action === 'update_holding') {
    const { holding_id, shares, avg_cost_basis, purchase_date, asset_type } = body
    const { data: holding, error } = await supabase
      .from('holdings')
      .update({ shares, avg_cost_basis, purchase_date: purchase_date || null, asset_type })
      .eq('id', holding_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(holding)
  }

  if (action === 'delete_holding') {
    const { holding_id } = body
    await supabase.from('holdings').delete().eq('id', holding_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'create_portfolio') {
    const { name, source } = body
    const { data: portfolio, error } = await supabase
      .from('portfolios')
      .insert({ user_id: user.id, name: name || 'My Portfolio', source: source || 'manual' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(portfolio)
  }

  if (action === 'seed_demo') {
    const { brokerage } = body
    const demoHoldings = getDemoHoldings(brokerage)

    let portfolio = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then((r) => r.data)

    if (!portfolio) {
      const { data } = await supabase
        .from('portfolios')
        .insert({ user_id: user.id, name: `${brokerage} Portfolio`, source: `simulated_${brokerage.toLowerCase()}` })
        .select()
        .single()
      portfolio = data
    }

    if (!portfolio) return NextResponse.json({ error: 'Could not create portfolio' }, { status: 500 })

    await supabase.from('holdings').delete().eq('portfolio_id', portfolio.id)
    await supabase.from('holdings').insert(demoHoldings.map((h) => ({ ...h, portfolio_id: portfolio!.id })))

    return NextResponse.json({ success: true, portfolio_id: portfolio.id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

function getDemoHoldings(brokerage: string) {
  const base = [
    { ticker: 'AAPL', company_name: 'Apple Inc.', shares: 15, avg_cost_basis: 145.20, purchase_date: '2022-03-15', asset_type: 'stock', sector: 'Technology' },
    { ticker: 'MSFT', company_name: 'Microsoft Corp.', shares: 8, avg_cost_basis: 285.50, purchase_date: '2022-06-10', asset_type: 'stock', sector: 'Technology' },
    { ticker: 'GOOGL', company_name: 'Alphabet Inc.', shares: 5, avg_cost_basis: 110.80, purchase_date: '2023-01-20', asset_type: 'stock', sector: 'Communication Services' },
    { ticker: 'AMZN', company_name: 'Amazon.com Inc.', shares: 10, avg_cost_basis: 134.60, purchase_date: '2023-04-05', asset_type: 'stock', sector: 'Consumer Discretionary' },
    { ticker: 'SPY', company_name: 'SPDR S&P 500 ETF', shares: 12, avg_cost_basis: 420.00, purchase_date: '2021-11-01', asset_type: 'etf', sector: 'Diversified' },
  ]

  if (brokerage === 'Fidelity') {
    base.push({ ticker: 'JPM', company_name: 'JPMorgan Chase & Co.', shares: 20, avg_cost_basis: 155.00, purchase_date: '2022-08-15', asset_type: 'stock', sector: 'Financials' })
  } else if (brokerage === 'Schwab') {
    base.push({ ticker: 'VTI', company_name: 'Vanguard Total Market ETF', shares: 30, avg_cost_basis: 210.00, purchase_date: '2022-01-10', asset_type: 'etf', sector: 'Diversified' })
  }

  return base
}
