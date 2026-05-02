'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { X, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HoldingWithPrice } from '@/types'

interface HoldingInsightResponse {
  ticker: string
  company_name: string
  asset_type: string
  sector: string
  industry: string | null
  current_price: number
  daily_change_pct: number
  history: Array<{ date: string; close: number }>
  fundamentals: {
    market_cap: number | null
    pe_ratio: number | null
    forward_pe: number | null
    beta: number | null
    dividend_yield_pct: number | null
    revenue_growth_pct: number | null
    profit_margin_pct: number | null
    debt_to_equity: number | null
    return_on_equity_pct: number | null
    target_mean_price: number | null
    recommendation: string | null
    fifty_two_week_high: number | null
    fifty_two_week_low: number | null
  }
  opinion: {
    verdict: 'Strong Fit' | 'Fit' | 'Watch' | 'Misaligned'
    summary: string
    personal_fit: string
    key_points: string[]
    risk_watch: string[]
  }
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function compact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function HoldingInsightModal({
  holding,
  portfolioId,
  onClose,
}: {
  holding: HoldingWithPrice
  portfolioId: string
  onClose: () => void
}) {
  const [period, setPeriod] = useState<'1mo' | '3mo' | '6mo' | '1y'>('3mo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<HoldingInsightResponse | null>(null)

  async function load(selectedPeriod: '1mo' | '3mo' | '6mo' | '1y' = period) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/holding-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolioId, holding_id: holding.id, period: selectedPeriod }),
      })
      if (!res.ok) {
        setError('Could not load holding details right now.')
        return
      }
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding.id, portfolioId, period])

  const dayUp = (data?.daily_change_pct ?? 0) >= 0
  const chartData = data?.history?.filter((point) => Number.isFinite(point.close) && point.close > 0) || []
  const hasChart = chartData.length > 0
  const verdictColor = useMemo(() => {
    const v = data?.opinion.verdict
    if (v === 'Strong Fit') return '#10B981'
    if (v === 'Fit') return '#4F8EF7'
    if (v === 'Watch') return '#f59e0b'
    return '#F43F5E'
  }, [data?.opinion.verdict])

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="glass rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-xl">{holding.ticker} — Deep Dive</h2>
            <p className="text-white/40 text-sm">Latest chart, fundamentals, and personalized AI view</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-52 bg-white/5 rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5 rounded-xl" />)}
            </div>
            <Skeleton className="h-24 bg-white/5 rounded-xl" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-white/60 text-sm mb-4">{error}</p>
            <Button onClick={() => load()} className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </div>
        ) : data && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="glass rounded-2xl p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <p className="text-white font-medium">{data.company_name}</p>
                    <p className="text-white/35 text-xs">{data.sector} {data.industry ? `· ${data.industry}` : ''}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white font-bold text-xl">{formatMoney(data.current_price)}</p>
                      <div className={`inline-flex items-center gap-1 text-xs ${dayUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                        {dayUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatPct(data.daily_change_pct)} today
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {[
                        { id: '1mo', label: '1M' },
                        { id: '3mo', label: '3M' },
                        { id: '6mo', label: '6M' },
                        { id: '1y', label: '1Y' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPeriod(p.id as '1mo' | '3mo' | '6mo' | '1y')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            period === p.id
                              ? 'bg-[#4F8EF7]/20 border-[#4F8EF7] text-[#4F8EF7]'
                              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white/70'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="h-56">
                  {hasChart ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" hide />
                        <YAxis
                          hide
                          domain={[(min: number) => min * 0.98, (max: number) => max * 1.02]}
                        />
                        <Tooltip
                          contentStyle={{ background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                          formatter={(value) => [formatMoney(typeof value === 'number' ? value : null), 'Close']}
                          labelFormatter={(label) => String(label)}
                        />
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke={dayUp ? '#10B981' : '#F43F5E'}
                          strokeWidth={2.2}
                          dot={chartData.length < 2}
                          activeDot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center text-xs text-white/45">
                      Price history unavailable for this period
                    </div>
                  )}
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <p className="text-white/45 text-xs uppercase tracking-wider mb-3">AI Opinion</p>
                <span className="inline-flex text-xs px-2 py-1 rounded-lg font-semibold mb-3" style={{ color: verdictColor, background: `${verdictColor}20` }}>
                  {data.opinion.verdict}
                </span>
                <p className="text-white/70 text-sm leading-relaxed mb-3">{data.opinion.summary}</p>
                <p className="text-white/55 text-xs leading-relaxed">{data.opinion.personal_fit}</p>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-white/45 text-xs uppercase tracking-wider mb-3">Fundamentals</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Metric label="Market Cap" value={compact(data.fundamentals.market_cap)} />
                <Metric label="P/E" value={data.fundamentals.pe_ratio?.toFixed(2) ?? 'N/A'} />
                <Metric label="Forward P/E" value={data.fundamentals.forward_pe?.toFixed(2) ?? 'N/A'} />
                <Metric label="Beta" value={data.fundamentals.beta?.toFixed(2) ?? 'N/A'} />
                <Metric label="Dividend Yield" value={formatPct(data.fundamentals.dividend_yield_pct)} />
                <Metric label="Revenue Growth" value={formatPct(data.fundamentals.revenue_growth_pct)} />
                <Metric label="Profit Margin" value={formatPct(data.fundamentals.profit_margin_pct)} />
                <Metric label="ROE" value={formatPct(data.fundamentals.return_on_equity_pct)} />
                <Metric label="Debt/Equity" value={data.fundamentals.debt_to_equity?.toFixed(2) ?? 'N/A'} />
                <Metric label="Target Mean" value={formatMoney(data.fundamentals.target_mean_price)} />
                  <Metric label="Street View" value={data.fundamentals.recommendation?.replace(/_/g, ' ') || 'N/A'} />
                <Metric label="52w High" value={formatMoney(data.fundamentals.fifty_two_week_high)} />
                <Metric label="52w Low" value={formatMoney(data.fundamentals.fifty_two_week_low)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5">
                <p className="text-white/45 text-xs uppercase tracking-wider mb-2">Key Points</p>
                <ul className="space-y-1.5">
                  {(data.opinion.key_points?.length ? data.opinion.key_points : ['No key points available yet.']).map((p, i) => (
                    <li key={i} className="text-white/65 text-sm">• {p}</li>
                  ))}
                </ul>
              </div>
              <div className="glass rounded-2xl p-5">
                <p className="text-white/45 text-xs uppercase tracking-wider mb-2">Risk Watch</p>
                <ul className="space-y-1.5">
                  {(data.opinion.risk_watch?.length ? data.opinion.risk_watch : ['No immediate risk flags from current inputs.']).map((p, i) => (
                    <li key={i} className="text-white/65 text-sm">• {p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <p className="text-white/30 text-xs">{label}</p>
      <p className="text-white/78 font-medium text-sm mt-0.5">{value}</p>
    </div>
  )
}

