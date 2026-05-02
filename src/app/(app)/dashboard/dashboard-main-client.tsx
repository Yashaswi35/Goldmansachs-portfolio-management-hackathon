'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence as AP } from 'framer-motion'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { IPSBanner } from '@/components/portfolio/ips-banner'
import { RiskFlags } from '@/components/portfolio/risk-flags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, PlusCircle, ArrowUpRight, ArrowDownRight,
  Pencil, Trash2, X, MessageSquare, Newspaper, Bot, Send, LinkIcon, X as CloseIcon,
} from 'lucide-react'
import type { HoldingWithPrice, Profile, Portfolio } from '@/types'

const HoldingInsightModal = dynamic(
  () => import('@/components/portfolio/holding-insight-modal').then((m) => m.HoldingInsightModal),
  { ssr: false }
)

type AIChatMessage = { role: 'user' | 'assistant'; content: string }

interface Props {
  profile: Profile | null
  portfolio: Portfolio | null
  holdings: HoldingWithPrice[]
  totalValue: number
  totalGainLoss: number
  totalGainLossPct: number
}

export function DashboardMainClient({ profile, portfolio, holdings, totalValue, totalGainLoss, totalGainLossPct }: Props) {
  const router = useRouter()
  const [editingHolding, setEditingHolding] = useState<HoldingWithPrice | null>(null)
  const [insightHolding, setInsightHolding] = useState<HoldingWithPrice | null>(null)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      role: 'assistant',
      content: 'I can use your portfolio, risk profile, and latest market context. You can also add optional X.com or Reddit links.',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [socialLinkInput, setSocialLinkInput] = useState('')
  const [socialLinks, setSocialLinks] = useState<string[]>([])
  const [socialNotes, setSocialNotes] = useState('')
  const [chatMeta, setChatMeta] = useState<{ news_count: number; holdings_count: number } | null>(null)

  const isPositive = totalGainLoss >= 0
  const firstName = profile?.full_name?.split(' ')[0] || 'Investor'

  const sectorData = useMemo(
    () => holdings.reduce<Record<string, number>>((acc, h) => {
      const sector = h.sector || 'Other'
      acc[sector] = (acc[sector] || 0) + h.allocation_pct
      return acc
    }, {}),
    [holdings]
  )
  const allocationData = useMemo(
    () =>
      Object.entries(sectorData)
        .map(([name, value]) => ({ name, value: typeof value === 'number' ? value : Number(value) }))
        .filter((item) => Number.isFinite(item.value) && item.value > 0)
        .sort((a, b) => b.value - a.value),
    [sectorData]
  )
  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.current_value - a.current_value),
    [holdings]
  )

  async function sendAIMessage() {
    const message = chatInput.trim()
    if (!message || !portfolio || chatLoading) return
    const outgoing = [...chatMessages, { role: 'user' as const, content: message }]
    setChatMessages(outgoing)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai/dashboard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          portfolio_id: portfolio.id,
          history: outgoing,
          social_links: socialLinks,
          social_notes: socialNotes,
        }),
      })
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data?.answer || 'No response available.' }])
      setChatMeta({ news_count: data?.news_count ?? 0, holdings_count: data?.holdings_count ?? holdings.length })
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'AI chat is temporarily unavailable. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  function addSocialLink() {
    const link = socialLinkInput.trim()
    if (!link) return
    const isX = /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\//i.test(link)
    const isReddit = /^(https?:\/\/)?(www\.)?reddit\.com\//i.test(link)
    if (!isX && !isReddit) return
    if (socialLinks.includes(link)) return setSocialLinkInput('')
    setSocialLinks((prev) => [...prev, link].slice(0, 8))
    setSocialLinkInput('')
  }

  return (
    <>
      <div className="p-6 max-w-6xl mx-auto space-y-5 pb-28">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Good {getTimeOfDay()}, {firstName}</h1>
            <p className="text-white/40 text-sm mt-0.5">Your portfolio dashboard</p>
          </div>
          <Link href="/portfolio/add">
            <Button className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 h-10 border border-[#F4EFE4]/30">
              <PlusCircle className="w-4 h-4" /> Add Investment
            </Button>
          </Link>
        </div>

        {profile?.investment_policy_statement && (
          <IPSBanner profile={profile as Parameters<typeof IPSBanner>[0]['profile']} />
        )}

        <div className="glass apple-surface rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/40 text-sm mb-1">Total portfolio value</p>
              <p className="text-4xl font-bold text-white">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className={`flex items-center gap-1.5 mt-2 ${isPositive ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span className="font-semibold text-sm">{isPositive ? '+' : ''}${Math.abs(totalGainLoss).toFixed(2)}</span>
                <span className="text-sm opacity-70">({isPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}%) all time</span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPositive ? 'bg-[#10B981]/15' : 'bg-[#F43F5E]/15'}`}>
              {isPositive ? <TrendingUp className="w-6 h-6 text-[#10B981]" /> : <TrendingDown className="w-6 h-6 text-[#F43F5E]" />}
            </div>
          </div>
        </div>

        {holdings.length > 0 && profile && (
          <RiskFlags holdings={holdings} profile={profile as Parameters<typeof RiskFlags>[0]['profile']} totalValue={totalValue} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="glass apple-surface rounded-2xl p-5">
            <p className="text-white/70 text-sm font-medium mb-2">Current allocation</p>
            <AllocationChart data={allocationData} />
          </div>
          <div className="lg:col-span-2 glass apple-surface rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-white font-semibold">My holdings</h2>
              <span className="text-white/30 text-sm">{holdings.length} investments</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Asset', 'Price', 'Today', 'Value', 'P&L', 'Weight'].map((h, i) => (
                      <th key={h} className={`${i === 0 ? 'text-left px-5' : 'text-right px-4'} py-3 text-white/30 text-xs font-medium uppercase tracking-wider`}>
                        {h}
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
                      onView={() => setInsightHolding(h)}
                      onEdit={() => setEditingHolding(h)}
                      onDelete={() => router.refresh()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-[70]">
        <AP>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-[min(92vw,420px)] h-[min(78vh,620px)] mb-3 glass apple-surface rounded-2xl border border-white/10 flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <Bot className="w-4 h-4 text-white/70" />
                  AI Portfolio Chat
                </div>
                <button onClick={() => setChatOpen(false)} className="p-1 rounded-md hover:bg-white/10 text-white/50">
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 py-2 border-b border-white/[0.06] space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={socialLinkInput}
                    onChange={(e) => setSocialLinkInput(e.target.value)}
                    placeholder="Add X.com or Reddit URL"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-8 text-xs"
                  />
                  <Button type="button" onClick={addSocialLink} className="micro-jiggle h-8 px-3 text-xs rounded-xl bg-white/10 text-white/80 hover:bg-white/15 border border-white/15">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                  {socialLinks.map((link) => (
                    <button
                      key={link}
                      type="button"
                      onClick={() => setSocialLinks((prev) => prev.filter((l) => l !== link))}
                      className="text-[10px] px-2 py-1 rounded-md bg-white/8 text-white/70 flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" /> remove link
                    </button>
                  ))}
                </div>
                <textarea
                  value={socialNotes}
                  onChange={(e) => setSocialNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional social sentiment notes"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>

              <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={`${msg.role}-${idx}`}
                    className={cn(
                      'max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
                      msg.role === 'assistant' ? 'bg-white/8 text-white/80' : 'ml-auto bg-[#4F8EF7]/25 text-white'
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="max-w-[80%] rounded-xl px-3 py-2 text-sm bg-white/8 text-white/60">
                    Analyzing portfolio + market + social context...
                  </div>
                )}
              </div>

              <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] space-y-2">
                {chatMeta && (
                  <div className="flex items-center gap-3 text-[11px] text-white/35">
                    <span className="flex items-center gap-1"><Newspaper className="w-3 h-3" /> {chatMeta.news_count} news</span>
                    <span>{chatMeta.holdings_count} holdings</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void sendAIMessage()
                      }
                    }}
                    placeholder="Ask about risk, allocation, or what to do next"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10"
                  />
                  <Button
                    onClick={() => void sendAIMessage()}
                    disabled={chatLoading || !portfolio || !chatInput.trim()}
                    className="micro-jiggle h-10 rounded-2xl bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] px-3 border border-[#F4EFE4]/30"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AP>

        <Button
          onClick={() => setChatOpen((v) => !v)}
          className="micro-jiggle soft-pill h-12 rounded-full bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] px-4 shadow-lg shadow-black/25 gap-2 border border-[#F4EFE4]/30"
        >
          <MessageSquare className="w-4 h-4" />
          {chatOpen ? 'Hide AI Chat' : 'AI Chat'}
        </Button>
      </div>

      <AP>
        {insightHolding && portfolio && (
          <HoldingInsightModal
            key={`insight-${insightHolding.id}`}
            holding={insightHolding}
            portfolioId={portfolio.id}
            onClose={() => setInsightHolding(null)}
          />
        )}
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

function HoldingRow({ holding, onView, onEdit, onDelete }: { holding: HoldingWithPrice; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isUp = holding.gain_loss >= 0
  const isDayUp = holding.daily_change_pct >= 0

  async function handleDelete() {
    if (!confirmDelete) return setConfirmDelete(true)
    setDeleting(true)
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_holding', holding_id: holding.id }),
    })
    onDelete()
  }

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={onView}>
      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><span className="text-white/80 font-bold text-xs">{holding.ticker.slice(0, 3)}</span></div><div><p className="text-white font-medium text-sm">{holding.ticker}</p><p className="text-white/35 text-xs truncate max-w-[120px]">{holding.company_name}</p></div></div></td>
      <td className="px-4 py-4 text-right"><p className="text-white text-sm font-medium">${holding.current_price.toFixed(2)}</p><p className="text-white/30 text-xs">{holding.shares} shares</p></td>
      <td className="px-4 py-4 text-right"><div className={`inline-flex items-center gap-0.5 text-sm font-medium ${isDayUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{isDayUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{Math.abs(holding.daily_change_pct).toFixed(2)}%</div></td>
      <td className="px-4 py-4 text-right"><p className="text-white text-sm font-medium">${holding.current_value.toFixed(2)}</p></td>
      <td className="px-4 py-4 text-right"><p className={`text-sm font-medium ${isUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{isUp ? '+' : ''}${holding.gain_loss.toFixed(2)}</p><p className={`text-xs ${isUp ? 'text-[#10B981]/70' : 'text-[#F43F5E]/70'}`}>{isUp ? '+' : ''}{holding.gain_loss_pct.toFixed(2)}%</p></td>
      <td className="px-5 py-4 text-right"><span className="text-white/60 text-xs">{holding.allocation_pct.toFixed(1)}%</span></td>
      <td className="px-4 py-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40"><Pencil className="w-3.5 h-3.5" /></button>{confirmDelete ? <button onClick={(e) => { e.stopPropagation(); void handleDelete() }} disabled={deleting} className="px-2 py-1 rounded-lg bg-[#F43F5E]/20 text-[#F43F5E] text-xs">{deleting ? '…' : 'Confirm?'}</button> : <button onClick={(e) => { e.stopPropagation(); void handleDelete() }} className="p-1.5 rounded-lg hover:bg-[#F43F5E]/15 text-white/40"><Trash2 className="w-3.5 h-3.5" /></button>}</div></td>
    </tr>
  )
}

function EditHoldingModal({ holding, onClose, onSaved }: { holding: HoldingWithPrice; onClose: () => void; onSaved: () => void }) {
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
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="glass apple-surface rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><div><h2 className="text-white font-semibold">Edit {holding.ticker}</h2></div><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40"><X className="w-4 h-4" /></button></div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Input type="number" step="0.000001" min="0.000001" value={shares} onChange={(e) => setShares(e.target.value)} required className="bg-white/5 border-white/10 text-white" /><Input type="number" step="0.01" min="0.01" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} required className="bg-white/5 border-white/10 text-white" /></div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="bg-white/5 border-white/10 text-white" />
            <div className="flex gap-1.5">{(['stock', 'etf', 'bond'] as const).map((t) => (<button key={t} type="button" onClick={() => setAssetType(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium border uppercase ${assetType === t ? 'bg-[#ECE6DB] border-[#ECE6DB]/70 text-[#1E1A18]' : 'bg-white/5 border-white/10 text-white/50'}`}>{t}</button>))}</div>
          </div>
          <div className="flex gap-3 pt-2"><Button type="button" onClick={onClose} variant="outline" className="flex-1 border-white/15 text-white/70">Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] border border-[#F4EFE4]/30">{saving ? 'Saving…' : 'Save changes'}</Button></div>
        </form>
      </motion.div>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
