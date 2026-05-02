'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence as AP } from 'framer-motion'
import Link from 'next/link'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { GlossaryTooltip } from '@/components/shared/glossary-tooltip'
import { IPSBanner } from '@/components/portfolio/ips-banner'
import { RiskFlags } from '@/components/portfolio/risk-flags'
import { StockAnalysisCard } from '@/components/portfolio/stock-analysis-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp, TrendingDown, PlusCircle, Brain, Shuffle,
  ArrowUpRight, ArrowDownRight, Sparkles, RefreshCw,
  Pencil, Trash2, X
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { HoldingWithPrice, Profile, Portfolio } from '@/types'
import type { StockAnalysis } from '@/app/api/ai/stock-analysis/route'

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#4F8EF7', Healthcare: '#10B981', Financials: '#a78bfa',
  'Consumer Discretionary': '#f59e0b', 'Communication Services': '#F43F5E',
  Energy: '#f97316', Industrials: '#06b6d4', Diversified: '#84cc16',
  'Real Estate': '#ec4899', Utilities: '#8b5cf6',
}

interface Props {
  profile: Profile | null
  portfolio: Portfolio | null
  holdings: HoldingWithPrice[]
  totalValue: number
  totalGainLoss: number
  totalGainLossPct: number
}

export function DashboardClient({ profile, portfolio, holdings, totalValue, totalGainLoss, totalGainLossPct }: Props) {
  const router = useRouter()
  const isPositive = totalGainLoss >= 0
  const firstName = profile?.full_name?.split(' ')[0] || 'Investor'
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [analysesLoaded, setAnalysesLoaded] = useState(false)
  const [editingHolding, setEditingHolding] = useState<HoldingWithPrice | null>(null)

  const sectorData = useMemo(
    () => holdings.reduce<Record<string, number>>((acc, h) => {
      const sector = h.sector || 'Other'
      acc[sector] = (acc[sector] || 0) + h.allocation_pct
      return acc
    }, {}),
    [holdings]
  )
  const allocationData = useMemo(
    () => Object.entries(sectorData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    [sectorData]
  )
  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.current_value - a.current_value),
    [holdings]
  )

  async function loadAIAnalyses() {
    if (!portfolio) return
    setLoadingAnalyses(true)
    try {
      const res = await fetch('/api/ai/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolio.id }),
      })
      const data = await res.json()
      setAnalyses(Array.isArray(data) ? data : [])
      setAnalysesLoaded(true)
    } finally {
      setLoadingAnalyses(false)
    }
  }

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
  const itemVariants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5">

        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Good {getTimeOfDay()}, {firstName} 👋</h1>
            <p className="text-white/40 text-sm mt-0.5">Here&apos;s how your investments are doing</p>
          </div>
          <Link href="/portfolio/add">
            <Button className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl gap-2 h-10">
              <PlusCircle className="w-4 h-4" /> Add Investment
            </Button>
          </Link>
        </motion.div>

        {/* IPS Banner */}
        {profile?.investment_policy_statement && (
          <motion.div variants={itemVariants}>
            <IPSBanner profile={profile as Parameters<typeof IPSBanner>[0]['profile']} />
          </motion.div>
        )}

        {/* Portfolio Value Card */}
        <motion.div variants={itemVariants}>
          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#4F8EF7]/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-white/40 text-sm mb-1">
                  Total <GlossaryTooltip term="portfolio" /> value
                </p>
                <p className="text-4xl font-bold text-white tracking-tight">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {holdings.length > 0 && (
                  <div className={`flex items-center gap-1.5 mt-2 ${isPositive ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                    {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span className="font-semibold text-sm">
                      {isPositive ? '+' : ''}${Math.abs(totalGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm opacity-70">
                      ({isPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}%) all time
                    </span>
                  </div>
                )}
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPositive ? 'bg-[#10B981]/15' : 'bg-[#F43F5E]/15'}`}>
                {isPositive
                  ? <TrendingUp className="w-6 h-6 text-[#10B981]" />
                  : <TrendingDown className="w-6 h-6 text-[#F43F5E]" />
                }
              </div>
            </div>

            {portfolio && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
                <Stat dot="#10B981" label={`${holdings.length} holdings`} />
                <Stat dot="#4F8EF7" label={`${Object.keys(sectorData).length} sectors`} />
                <Stat dot="#a78bfa" label={`${profile?.risk_archetype?.replace('_', ' ') || profile?.risk_tolerance || '—'} strategy`} capitalize />
                {profile?.target_stock_pct && (
                  <Stat dot="#f59e0b" label={`Target: ${profile.target_stock_pct}% stocks`} />
                )}
              </div>
            )}
          </div>
        </motion.div>

        {holdings.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Risk Flags */}
            {profile && (
              <motion.div variants={itemVariants}>
                <RiskFlags holdings={holdings} profile={profile as Parameters<typeof RiskFlags>[0]['profile']} totalValue={totalValue} />
              </motion.div>
            )}

            {/* Chart + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <motion.div variants={itemVariants} className="lg:col-span-1">
                <div className="glass rounded-2xl p-5 h-full">
                  <p className="text-white/60 text-sm font-medium mb-1">
                    <GlossaryTooltip term="allocation" /> by sector
                  </p>
                  <AllocationChart data={allocationData} />
                  <div className="space-y-1.5 mt-2">
                    {allocationData.slice(0, 5).map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: SECTOR_COLORS[d.name] || `hsl(${i * 60},70%,60%)` }}
                          />
                          <span className="text-white/50 truncate">{d.name}</span>
                        </div>
                        <span className="text-white/70 font-medium">{d.value.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="lg:col-span-2 space-y-3">
                <Link href="/analysis">
                  <div className="glass-hover rounded-2xl p-5 flex items-center gap-4 cursor-pointer">
                    <div className="w-11 h-11 rounded-xl bg-[#a78bfa]/15 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-[#a78bfa]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">Deep AI Analysis</p>
                      <p className="text-white/40 text-xs mt-0.5">Risk score, sector insights, investment suggestions</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </div>
                </Link>
                <Link href="/rebalance">
                  <div className="glass-hover rounded-2xl p-5 flex items-center gap-4 cursor-pointer">
                    <div className="w-11 h-11 rounded-xl bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                      <Shuffle className="w-5 h-5 text-[#10B981]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">Smart Rebalancing</p>
                      <p className="text-white/40 text-xs mt-0.5">3 personalized strategies to optimize your portfolio</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </div>
                </Link>
                <div className="glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">Your Profile</p>
                  <div className="grid grid-cols-2 gap-3">
                    <ProfileStat label="Risk Style" value={profile?.risk_archetype?.replace(/_/g, ' ') || profile?.risk_tolerance || '—'} capitalize />
                    <ProfileStat label="Goal" value={profile?.investment_goal || '—'} capitalize />
                    <ProfileStat label="Horizon" value={profile?.investment_horizon || '—'} />
                    <ProfileStat label="Age" value={profile?.age ? `${profile.age} yrs` : '—'} />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Holdings Table */}
            <motion.div variants={itemVariants}>
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <h2 className="text-white font-semibold">Your Holdings</h2>
                  <span className="text-white/30 text-sm">{holdings.length} investments</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        {['Asset', 'Price', 'Today', 'Value', 'P&L', 'Weight'].map((h, i) => (
                          <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-white/30 text-xs font-medium uppercase tracking-wider`}>
                            {h === 'P&L' ? <GlossaryTooltip term="P&L" /> : h}
                          </th>
                        ))}
                        <th className="px-4 py-3 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHoldings.map((h) => (
                        <HoldingRow
                          key={h.id}
                          holding={h}
                          onEdit={() => setEditingHolding(h)}
                          onDelete={() => router.refresh()}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Per-stock AI Analysis Section */}
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#a78bfa]" />
                  <h2 className="text-white font-semibold">AI Stock Analysis</h2>
                  <span className="text-white/30 text-xs">— does each holding fit your profile?</span>
                </div>
                <Button
                  onClick={loadAIAnalyses}
                  disabled={loadingAnalyses}
                  size="sm"
                  className="bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 text-[#a78bfa] border border-[#a78bfa]/20 rounded-xl gap-2 h-8 text-xs"
                >
                  {loadingAnalyses
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...</>
                    : analysesLoaded
                      ? <><RefreshCw className="w-3 h-3" /> Refresh</>
                      : <><Sparkles className="w-3 h-3" /> Analyze All Stocks</>
                  }
                </Button>
              </div>

              {loadingAnalyses ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {holdings.map((_, i) => (
                    <div key={i} className="glass rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl bg-white/5" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-3.5 w-1/3 bg-white/5" />
                          <Skeleton className="h-2.5 w-1/2 bg-white/5" />
                        </div>
                      </div>
                      <Skeleton className="h-12 bg-white/5 rounded-lg" />
                      <Skeleton className="h-8 bg-white/5 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : analysesLoaded && analyses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analyses.map((a, i) => (
                    <StockAnalysisCard key={a.ticker} analysis={a} index={i} />
                  ))}
                </div>
              ) : !analysesLoaded ? (
                <div className="glass rounded-2xl p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#a78bfa]/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-[#a78bfa]" />
                  </div>
                  <p className="text-white/60 text-sm font-medium mb-1">Get AI analysis for every holding</p>
                  <p className="text-white/30 text-xs max-w-sm mx-auto">
                    Our AI will review each stock against your personal risk profile and tell you: what it is, how it&apos;s performing, and whether you should hold, trim, or exit.
                  </p>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </motion.div>
      </div>

      <AP>
        {editingHolding && (
          <EditHoldingModal
            key={editingHolding.id}
            holding={editingHolding}
            onClose={() => setEditingHolding(null)}
            onSaved={() => { setEditingHolding(null); router.refresh() }}
          />
        )}
      </AP>
    </>
  )
}

function HoldingRow({ holding, onEdit, onDelete }: {
  holding: HoldingWithPrice
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isUp = holding.gain_loss >= 0
  const isDayUp = holding.daily_change_pct >= 0

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_holding', holding_id: holding.id }),
    })
    onDelete()
  }

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4F8EF7]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[#4F8EF7] font-bold text-xs">{holding.ticker.slice(0, 3)}</span>
          </div>
          <div>
            <p className="text-white font-medium text-sm">{holding.ticker}</p>
            <p className="text-white/35 text-xs truncate max-w-[120px]">{holding.company_name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <p className="text-white text-sm font-medium">${holding.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className="text-white/30 text-xs">{holding.shares} shares</p>
      </td>
      <td className="px-4 py-4 text-right">
        <div className={`inline-flex items-center gap-0.5 text-sm font-medium ${isDayUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
          {isDayUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(holding.daily_change_pct).toFixed(2)}%
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <p className="text-white text-sm font-medium">${holding.current_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      </td>
      <td className="px-4 py-4 text-right">
        <p className={`text-sm font-medium ${isUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
          {isUp ? '+' : ''}${holding.gain_loss.toFixed(2)}
        </p>
        <p className={`text-xs ${isUp ? 'text-[#10B981]/70' : 'text-[#F43F5E]/70'}`}>
          {isUp ? '+' : ''}{holding.gain_loss_pct.toFixed(2)}%
        </p>
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#4F8EF7] rounded-full" style={{ width: `${Math.min(holding.allocation_pct, 100)}%` }} />
          </div>
          <span className="text-white/50 text-xs w-10 text-right">{holding.allocation_pct.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirmDelete ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 rounded-lg bg-[#F43F5E]/20 hover:bg-[#F43F5E]/30 text-[#F43F5E] text-xs font-medium transition-all"
            >
              {deleting ? '…' : 'Confirm?'}
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-[#F43F5E]/15 text-white/40 hover:text-[#F43F5E] transition-all"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function EditHoldingModal({ holding, onClose, onSaved }: {
  holding: HoldingWithPrice
  onClose: () => void
  onSaved: () => void
}) {
  const [shares, setShares] = useState(holding.shares.toString())
  const [costBasis, setCostBasis] = useState(holding.avg_cost_basis.toFixed(2))
  const [purchaseDate, setPurchaseDate] = useState(holding.purchase_date || '')
  const [assetType, setAssetType] = useState(holding.asset_type || 'stock')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_holding',
        holding_id: holding.id,
        shares: parseFloat(shares),
        avg_cost_basis: parseFloat(costBasis),
        purchase_date: purchaseDate || null,
        asset_type: assetType,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="glass rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold">Edit {holding.ticker}</h2>
            <p className="text-white/40 text-xs mt-0.5">{holding.company_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/60 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Shares</label>
              <Input
                type="number"
                step="0.000001"
                min="0.000001"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7]"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Avg cost basis ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5">Purchase date</label>
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
              <div className="flex gap-1.5">
                {(['stock', 'etf', 'bond'] as const).map((t) => (
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

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/15 text-white/70 hover:bg-white/5 rounded-xl h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl h-10"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function Stat({ dot, label, capitalize }: { dot: string; label: string; capitalize?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-white/40 text-xs ${capitalize ? 'capitalize' : ''}`}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </div>
  )
}

function ProfileStat({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-white/30 text-xs">{label}</p>
      <p className={`text-white text-sm font-medium mt-0.5 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#4F8EF7]/10 flex items-center justify-center mx-auto mb-4">
        <TrendingUp className="w-8 h-8 text-[#4F8EF7]" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">Add your first investment</h3>
      <p className="text-white/40 text-sm max-w-xs mx-auto mb-6">
        Track your stocks, ETFs, and other investments. We&apos;ll give you AI-powered insights to help you grow confidently.
      </p>
      <Link href="/portfolio/add">
        <Button className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl gap-2">
          <PlusCircle className="w-4 h-4" /> Add your first investment
        </Button>
      </Link>
    </motion.div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
