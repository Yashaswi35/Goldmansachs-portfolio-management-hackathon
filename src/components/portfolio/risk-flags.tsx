'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, TrendingDown, Layers, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { HoldingWithPrice, Profile } from '@/types'

interface RiskFlag {
  severity: 'high' | 'medium' | 'low'
  icon: React.ReactNode
  title: string
  detail: string
}

function computeRiskFlags(
  holdings: HoldingWithPrice[],
  profile: Profile & { target_stock_pct?: number | null; risk_archetype?: string | null }
): RiskFlag[] {
  const flags: RiskFlag[] = []
  if (!holdings.length) return flags

  // Concentration check — single stock >25%
  holdings.forEach((h) => {
    if (h.allocation_pct > 25) {
      flags.push({
        severity: h.allocation_pct > 40 ? 'high' : 'medium',
        icon: <Layers className="w-4 h-4" />,
        title: `${h.ticker} is ${h.allocation_pct.toFixed(0)}% of your portfolio`,
        detail: `A single position over 25% creates concentrated risk. If ${h.ticker} drops significantly, it will have an outsized impact on your total wealth.`,
      })
    }
  })

  // Sector concentration >50%
  const sectorMap: Record<string, number> = {}
  holdings.forEach((h) => {
    const s = h.sector || 'Other'
    sectorMap[s] = (sectorMap[s] || 0) + h.allocation_pct
  })
  Object.entries(sectorMap).forEach(([sector, pct]) => {
    if (pct > 50 && sector !== 'Diversified') {
      flags.push({
        severity: pct > 70 ? 'high' : 'medium',
        icon: <Globe className="w-4 h-4" />,
        title: `${pct.toFixed(0)}% in ${sector} sector`,
        detail: `Heavy concentration in one sector means sector-wide events (regulation, recession, rates) hit you hard. A balanced portfolio usually keeps any single sector under 30%.`,
      })
    }
  })

  // Significant losses
  holdings.forEach((h) => {
    if (h.gain_loss_pct < -20) {
      flags.push({
        severity: h.gain_loss_pct < -40 ? 'high' : 'medium',
        icon: <TrendingDown className="w-4 h-4" />,
        title: `${h.ticker} is down ${Math.abs(h.gain_loss_pct).toFixed(0)}% from what you paid`,
        detail: `You're currently at a loss on this position. Consider reviewing whether the original reason you bought it still holds true.`,
      })
    }
  })

  // No bonds for conservative/older investor
  const stockOnlyPct = holdings.filter(h => h.asset_type === 'stock').reduce((s, h) => s + h.allocation_pct, 0)
  const bondPct = holdings.filter(h => h.asset_type === 'bond' || h.asset_type === 'etf').reduce((s, h) => s + h.allocation_pct, 0)
  const isOlderConservative = (profile.age || 30) > 50 ||
    profile.risk_archetype === 'conservative' || profile.risk_archetype === 'moderately_conservative' ||
    profile.risk_tolerance === 'conservative'
  if (isOlderConservative && bondPct < 15 && stockOnlyPct > 80) {
    flags.push({
      severity: 'medium',
      icon: <AlertTriangle className="w-4 h-4" />,
      title: 'No bonds or stable assets in portfolio',
      detail: `Given your risk profile and age, financial advisors typically recommend having 20-40% in bonds or stable assets to cushion against stock market downturns.`,
    })
  }

  return flags.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
}

const SEVERITY_COLOR = { high: '#F43F5E', medium: '#f59e0b', low: '#4F8EF7' }

interface Props {
  holdings: HoldingWithPrice[]
  profile: Profile & { target_stock_pct?: number | null; risk_archetype?: string | null }
  totalValue: number
}

export function RiskFlags({ holdings, profile }: Props) {
  const [expanded, setExpanded] = useState(true)
  const flags = computeRiskFlags(holdings, profile)

  if (!flags.length) return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 flex items-center gap-3 border border-[#10B981]/15"
    >
      <div className="w-8 h-8 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
        <span className="text-lg">✅</span>
      </div>
      <div>
        <p className="text-white/70 text-sm font-medium">Portfolio looks healthy</p>
        <p className="text-white/35 text-xs">No major risk flags detected for your profile</p>
      </div>
    </motion.div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-[#F43F5E]/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-[#F43F5E]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-medium text-sm">
            {flags.length} Risk {flags.length === 1 ? 'Flag' : 'Flags'} Detected
          </p>
          <p className="text-white/35 text-xs">
            {flags.filter(f => f.severity === 'high').length} critical · {flags.filter(f => f.severity === 'medium').length} moderate
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-2 border-t border-white/[0.05]">
              {flags.map((flag, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="p-3 rounded-xl border mt-2"
                  style={{
                    borderColor: `${SEVERITY_COLOR[flag.severity]}20`,
                    background: `${SEVERITY_COLOR[flag.severity]}06`,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0" style={{ color: SEVERITY_COLOR[flag.severity] }}>
                      {flag.icon}
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium mb-0.5">{flag.title}</p>
                      <p className="text-white/45 text-xs leading-relaxed">{flag.detail}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
