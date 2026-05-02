'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, TrendingUp, TrendingDown, CheckCircle2,
  ArrowLeft, Plus
} from 'lucide-react'
import type { MarketQuote } from '@/types'

interface SearchResult { ticker: string; name: string; type: string; exchange: string }

export default function AddPortfolioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedStock, setSelectedStock] = useState<MarketQuote | null>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const [shares, setShares] = useState('')
  const [costBasis, setCostBasis] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [assetType, setAssetType] = useState('stock')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const searchTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (query.length < 1) { setSearchResults([]); setShowDropdown(false); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setLoadingSearch(true)
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setSearchResults(data)
      setShowDropdown(data.length > 0)
      setLoadingSearch(false)
    }, 300)
  }, [query])

  async function selectStock(result: SearchResult) {
    setShowDropdown(false)
    setQuery(result.ticker)
    setLoadingQuote(true)
    setSelectedStock(null)

    const res = await fetch(`/api/market/quote?ticker=${result.ticker}`)
    if (res.ok) {
      const quote = await res.json()
      setSelectedStock(quote)
      setCostBasis(quote.current_price.toFixed(2))
      setAssetType(result.type === 'ETF' ? 'etf' : 'stock')
    }
    setLoadingQuote(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStock) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/signin'); return }

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let portfolioId = portfolio?.id
    if (!portfolioId) {
      const { data: newPortfolio } = await supabase
        .from('portfolios')
        .insert({ user_id: user.id, name: 'My Portfolio', source: 'manual' })
        .select()
        .single()
      portfolioId = newPortfolio?.id
    }

    if (!portfolioId) { setSaving(false); return }

    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_holding',
        portfolio_id: portfolioId,
        ticker: selectedStock.ticker,
        company_name: selectedStock.company_name,
        shares: parseFloat(shares),
        avg_cost_basis: parseFloat(costBasis),
        purchase_date: purchaseDate || null,
        asset_type: assetType,
        sector: selectedStock.sector,
      }),
    })

    setSuccess(true)
    setSaving(false)
    setTimeout(() => {
      setSelectedStock(null)
      setQuery('')
      setShares('')
      setCostBasis('')
      setPurchaseDate('')
      setSuccess(false)
    }, 2000)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Add an Investment</h1>
          <p className="text-white/40 text-sm mt-1">Search for any stock or ETF to add to your portfolio</p>
        </div>

        {/* Ticker Search */}
        <div className="glass rounded-2xl p-6 mb-5">
          <label className="block text-white/60 text-sm mb-2">Search stock or ETF</label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedStock(null) }}
                placeholder="e.g. Apple, AAPL, S&P 500..."
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7]"
                autoFocus
              />
              {loadingSearch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              )}
            </div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden border border-white/10 bg-[#0D0D14]"
                >
                  {searchResults.map((r) => (
                    <button
                      key={r.ticker}
                      onClick={() => selectStock(r)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4F8EF7]/10 flex items-center justify-center">
                          <span className="text-[#4F8EF7] text-xs font-bold">{r.ticker.slice(0, 3)}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{r.ticker}</p>
                          <p className="text-white/40 text-xs truncate max-w-[200px]">{r.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/20 text-xs">{r.exchange}</span>
                        <span className="text-[#4F8EF7]/60 text-xs bg-[#4F8EF7]/10 px-2 py-0.5 rounded-full">{r.type}</span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected Stock Preview */}
          <AnimatePresence>
            {loadingQuote && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 rounded-xl bg-white/5 border border-white/8">
                <div className="space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
                </div>
              </motion.div>
            )}

            {selectedStock && !loadingQuote && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-xl bg-[#4F8EF7]/5 border border-[#4F8EF7]/20"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{selectedStock.company_name}</p>
                    <p className="text-white/40 text-xs mt-0.5">{selectedStock.ticker} · {selectedStock.sector || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">
                      ${selectedStock.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`flex items-center justify-end gap-0.5 text-xs ${selectedStock.daily_change_pct >= 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                      {selectedStock.daily_change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(selectedStock.daily_change_pct).toFixed(2)}% today
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                  {selectedStock.pe_ratio && (
                    <div>
                      <p className="text-white/30 text-xs">P/E Ratio</p>
                      <p className="text-white/70 text-sm font-medium">{selectedStock.pe_ratio.toFixed(1)}</p>
                    </div>
                  )}
                  {selectedStock.fifty_two_week_high && (
                    <div>
                      <p className="text-white/30 text-xs">52w High</p>
                      <p className="text-white/70 text-sm font-medium">${selectedStock.fifty_two_week_high.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedStock.fifty_two_week_low && (
                    <div>
                      <p className="text-white/30 text-xs">52w Low</p>
                      <p className="text-white/70 text-sm font-medium">${selectedStock.fifty_two_week_low.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Details Form */}
        <AnimatePresence>
          {selectedStock && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <form onSubmit={handleAdd} className="glass rounded-2xl p-6 space-y-4">
                <h2 className="text-white font-semibold">Investment details</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-1.5">Number of shares</label>
                    <Input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      placeholder="e.g. 10"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7]"
                    />
                    <p className="text-white/25 text-xs mt-1">How many units you own</p>
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1.5">Price you paid per share ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={costBasis}
                      onChange={(e) => setCostBasis(e.target.value)}
                      placeholder="e.g. 150.00"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7]"
                    />
                    <p className="text-white/25 text-xs mt-1">Your average cost basis</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-1.5">Purchase date (optional)</label>
                    <Input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="bg-white/5 border-white/10 text-white focus:border-[#4F8EF7]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-1.5">Asset type</label>
                    <div className="flex gap-2">
                      {['stock', 'etf', 'bond'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setAssetType(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all uppercase ${
                            assetType === t
                              ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                              : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {shares && costBasis && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/8">
                    <p className="text-white/40 text-xs">Position value</p>
                    <p className="text-white font-semibold text-lg">
                      ${(parseFloat(shares || '0') * parseFloat(costBasis || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={saving || success}
                  className={`w-full h-11 rounded-xl font-medium gap-2 transition-all ${
                    success
                      ? 'bg-[#10B981] hover:bg-[#10B981]'
                      : 'bg-[#4F8EF7] hover:bg-[#4F8EF7]/90'
                  } text-white`}
                >
                  {success ? (
                    <><CheckCircle2 className="w-4 h-4" /> Added successfully!</>
                  ) : saving ? (
                    'Adding...'
                  ) : (
                    <><Plus className="w-4 h-4" /> Add to portfolio</>
                  )}
                </Button>
              </form>

              <div className="flex justify-center mt-4">
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="ghost"
                  className="text-white/40 hover:text-white/60 text-sm"
                >
                  View portfolio →
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
