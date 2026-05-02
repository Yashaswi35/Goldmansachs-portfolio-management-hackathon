'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { StockAnalysis } from '@/app/api/ai/stock-analysis/route'

const FIT_CONFIG = {
  excellent: { label: 'Great fit', color: '#10B981', bg: '#10B981' },
  good: { label: 'Good fit', color: '#4F8EF7', bg: '#4F8EF7' },
  caution: { label: 'Review needed', color: '#f59e0b', bg: '#f59e0b' },
  alert: { label: 'Misaligned ⚠️', color: '#F43F5E', bg: '#F43F5E' },
}

const ACTION_CONFIG = {
  ADD: { color: '#10B981', bg: '#10B981' },
  HOLD: { color: '#4F8EF7', bg: '#4F8EF7' },
  TRIM: { color: '#f59e0b', bg: '#f59e0b' },
  EXIT: { color: '#F43F5E', bg: '#F43F5E' },
}

const SIGNAL_ICON = {
  bullish: <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />,
  neutral: <Minus className="w-3.5 h-3.5 text-[#f59e0b]" />,
  bearish: <TrendingDown className="w-3.5 h-3.5 text-[#F43F5E]" />,
}

const SIGNAL_COLOR = {
  bullish: '#10B981',
  neutral: '#f59e0b',
  bearish: '#F43F5E',
}

export function StockAnalysisCard({ analysis, index }: { analysis: StockAnalysis; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const fit = FIT_CONFIG[analysis.profile_fit]
  const action = ACTION_CONFIG[analysis.action]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass rounded-2xl overflow-hidden border transition-all ${
        analysis.profile_fit === 'alert' ? 'border-[#F43F5E]/25' :
        analysis.profile_fit === 'caution' ? 'border-[#f59e0b]/20' :
        'border-white/[0.06]'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4F8EF7]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[#4F8EF7] font-bold text-xs">{analysis.ticker.slice(0, 4)}</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{analysis.ticker}</p>
              <p className="text-white/35 text-xs truncate max-w-[140px]">{analysis.company_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Profile fit badge */}
            <span
              className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ color: fit.color, background: `${fit.bg}15` }}
            >
              {fit.label}
            </span>
            {/* Action badge */}
            <span
              className="text-xs px-2 py-1 rounded-lg font-bold uppercase"
              style={{ color: action.color, background: `${action.bg}15` }}
            >
              {analysis.action}
            </span>
          </div>
        </div>

        {/* What is it */}
        <p className="text-white/55 text-xs leading-relaxed mb-3">{analysis.what_is_it}</p>

        {/* Key metrics row */}
        {analysis.key_metrics?.length > 0 && (
          <div className="flex gap-3 mb-3">
            {analysis.key_metrics.slice(0, 3).map((m, i) => (
              <div key={i} className="flex-1 bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-white/30 text-[10px] mb-0.5">{m.label}</p>
                <p className="text-white/80 text-xs font-semibold">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Risk flags */}
        {analysis.risk_flags?.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {analysis.risk_flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#F43F5E]/5 border border-[#F43F5E]/10">
                <AlertTriangle className="w-3 h-3 text-[#F43F5E] mt-0.5 flex-shrink-0" />
                <p className="text-[#F43F5E]/80 text-xs leading-relaxed">{flag}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action reason — always visible */}
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
          style={{ background: `${action.color}08`, borderLeft: `2px solid ${action.color}40` }}
        >
          <span className="font-bold flex-shrink-0" style={{ color: action.color }}>
            {analysis.action}:
          </span>
          <span className="text-white/60">{analysis.action_reason}</span>
        </div>
      </div>

      {/* Expandable deep dive */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-white/25 hover:text-white/50 text-xs border-t border-white/[0.05] transition-colors"
      >
        {expanded ? 'Less detail' : 'More detail'}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pb-4 space-y-2.5 border-t border-white/[0.05] pt-3"
        >
          <DetailRow
            icon={SIGNAL_ICON[analysis.performance_signal]}
            label="Performance"
            value={analysis.performance_reason}
            color={SIGNAL_COLOR[analysis.performance_signal]}
          />
          <DetailRow
            icon={<Info className="w-3.5 h-3.5" style={{ color: fit.color }} />}
            label="Profile match"
            value={analysis.profile_fit_reason}
            color={fit.color}
          />
        </motion.div>
      )}
    </motion.div>
  )
}

function DetailRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <span className="text-xs font-medium mr-1.5" style={{ color }}>{label}:</span>
        <span className="text-white/55 text-xs">{value}</span>
      </div>
    </div>
  )
}
