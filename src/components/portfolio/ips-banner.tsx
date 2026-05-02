'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, ChevronUp, Target } from 'lucide-react'
import type { Profile } from '@/types'

interface Props {
  profile: Profile & {
    investment_policy_statement?: string | null
    target_stock_pct?: number | null
    target_bond_pct?: number | null
    target_cash_pct?: number | null
    risk_archetype?: string | null
  }
}

export function IPSBanner({ profile }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!profile.investment_policy_statement) return null

  const stockPct = profile.target_stock_pct || 70
  const bondPct = profile.target_bond_pct || 20
  const cashPct = profile.target_cash_pct || 10

  const archetypeLabel: Record<string, { label: string; color: string }> = {
    conservative: { label: 'Conservative', color: '#10B981' },
    moderately_conservative: { label: 'Mod. Conservative', color: '#06b6d4' },
    moderate: { label: 'Moderate', color: '#4F8EF7' },
    moderately_aggressive: { label: 'Mod. Aggressive', color: '#a78bfa' },
    aggressive: { label: 'Aggressive', color: '#f59e0b' },
  }

  const archetype = archetypeLabel[profile.risk_archetype || profile.risk_tolerance || 'moderate'] ||
    archetypeLabel['moderate']

  return (
    <div className="glass rounded-2xl overflow-hidden border border-[#4F8EF7]/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-[#4F8EF7]/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-[#4F8EF7]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium text-sm">Your Investment Policy Statement</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: archetype.color, background: `${archetype.color}15` }}
            >
              {archetype.label}
            </span>
          </div>
          {!expanded && (
            <p className="text-white/35 text-xs truncate mt-0.5">{profile.investment_policy_statement}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-white/30">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] space-y-4">
              <p className="text-white/65 text-sm leading-relaxed pt-4">
                {profile.investment_policy_statement}
              </p>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-[#4F8EF7]" />
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Target Allocation</p>
                </div>
                <div className="space-y-2">
                  <AllocationBar label="Stocks" pct={stockPct} color="#4F8EF7" />
                  <AllocationBar label="Bonds" pct={bondPct} color="#10B981" />
                  <AllocationBar label="Cash" pct={cashPct} color="#a78bfa" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AllocationBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/40 text-xs w-12">{label}</span>
      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-white/60 text-xs w-8 text-right font-medium">{pct}%</span>
    </div>
  )
}
