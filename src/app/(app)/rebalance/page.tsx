'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { GlossaryTooltip } from '@/components/shared/glossary-tooltip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Shuffle, RefreshCw, ChevronDown, ChevronUp, Shield,
  TrendingUp, Zap, CheckCircle2, Info, Plus, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import type { RebalancingScenario, RebalancingAction } from '@/types'

const SCENARIO_CONFIG = {
  conservative: {
    icon: Shield,
    color: '#D6D3D1',
    bg: '#D6D3D1',
    gradient: 'from-white/[0.05] to-white/[0.02]',
    border: 'border-white/15',
    label: 'Conservative',
  },
  moderate: {
    icon: TrendingUp,
    color: '#D6D3D1',
    bg: '#D6D3D1',
    gradient: 'from-white/[0.05] to-white/[0.02]',
    border: 'border-white/15',
    label: 'Moderate',
  },
  aggressive: {
    icon: Zap,
    color: '#D6D3D1',
    bg: '#D6D3D1',
    gradient: 'from-white/[0.05] to-white/[0.02]',
    border: 'border-white/15',
    label: 'Aggressive',
  },
}

export default function RebalancePage() {
  const supabase = createClient()
  const [scenarios, setScenarios] = useState<RebalancingScenario[]>([])
  const [triggerReason, setTriggerReason] = useState<string | null>(null)
  const [triggered, setTriggered] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'threshold' | 'calendar' | 'hybrid'>('hybrid')
  const [loading, setLoading] = useState(false)
  const [portfolioId, setPortfolioId] = useState<string | null>(null)
  const [hasHoldings, setHasHoldings] = useState(false)
  const [ran, setRan] = useState(false)
  const [adoptedScenario, setAdoptedScenario] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id, holdings(id)')
        .eq('user_id', user.id)
        .maybeSingle()
      if (portfolio) {
        setPortfolioId(portfolio.id)
        setHasHoldings((portfolio.holdings as unknown[]).length > 0)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateScenarios() {
    if (!portfolioId) return
    setLoading(true)
    setRan(true)
    setAdoptedScenario(null)
    try {
      const res = await fetch('/api/ai/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolioId, mode, threshold_pct: 5 }),
      })
      const data = await res.json()
      setScenarios(data.scenarios || [])
      setTriggerReason(data.trigger_reason || null)
      setTriggered(typeof data.trigger === 'boolean' ? data.trigger : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Smart <GlossaryTooltip term="rebalancing" /></h1>
            <p className="text-white/40 text-sm mt-0.5">Choose a strategy to optimize your portfolio</p>
          </div>
          <div className="flex items-center gap-2">
            {hasHoldings && (
              <>
                <div className="flex gap-1.5">
                  {[
                    { id: 'threshold', label: 'Threshold' },
                    { id: 'calendar', label: 'Calendar' },
                    { id: 'hybrid', label: 'Hybrid' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id as 'threshold' | 'calendar' | 'hybrid')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        mode === m.id
                          ? 'bg-[#ECE6DB] border-[#ECE6DB]/70 text-[#1E1A18]'
                          : 'bg-white/5 border-white/10 text-white/45 hover:text-white/70'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={generateScenarios}
                  disabled={loading}
                  className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 h-10 border border-[#F4EFE4]/30"
                >
                  {loading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Shuffle className="w-4 h-4" /> {ran ? 'Regenerate' : 'Generate Strategies'}</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {!hasHoldings ? (
          <EmptyState />
        ) : !ran ? (
          <RebalanceCTA onRun={generateScenarios} />
        ) : loading ? (
          <LoadingSkeleton />
        ) : scenarios.length > 0 && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="glass apple-surface rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white/70 text-sm font-medium">Engine Trigger Status</p>
                  <p className={`text-xs mt-0.5 ${triggered ? 'text-[#10B981]' : 'text-[#f59e0b]'}`}>
                    {triggered ? 'Triggered' : 'No trigger yet'}
                  </p>
                  {triggerReason && <p className="text-white/35 text-xs mt-1">{triggerReason}</p>}
                </div>
              </div>

              {/* Strategy explanation banner */}
              <div className="glass apple-surface rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-white/50 text-sm">
                  These are <strong className="text-white/70">advisory suggestions only</strong> — we&apos;ll tell you exactly what to do, but you make the final call.
                  Click &quot;Adopt This Strategy&quot; to save it as your plan, then follow the steps at your own pace.
                </p>
              </div>

              {/* 3 Scenario Cards */}
              <div className="grid grid-cols-1 gap-5">
                {scenarios.map((scenario, i) => (
                  <ScenarioCard
                    key={scenario.scenario_type}
                    scenario={scenario}
                    index={i}
                    adopted={adoptedScenario === scenario.scenario_type}
                    onAdopt={() => setAdoptedScenario(scenario.scenario_type)}
                  />
                ))}
              </div>

              <div className="glass apple-surface rounded-2xl p-5 flex items-start gap-3">
                <Info className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <p className="text-white/30 text-xs">
                  NestEgg does not execute trades. These suggestions are for educational purposes only and do not constitute financial advice.
                  Always consider consulting a licensed financial advisor before making investment decisions.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  )
}

function ScenarioCard({ scenario, index, adopted, onAdopt }: {
  scenario: RebalancingScenario
  index: number
  adopted: boolean
  onAdopt: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = SCENARIO_CONFIG[scenario.scenario_type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`glass apple-surface rounded-2xl overflow-hidden border transition-all ${
        adopted ? 'border-' + config.color.slice(1) + '/40' : 'border-white/[0.06]'
      } ${adopted ? 'ring-1 ring-' + config.color.slice(1) + '/20' : ''}`}
      style={adopted ? { borderColor: `${config.color}40`, boxShadow: `0 0 20px ${config.color}10` } : {}}
    >
      {/* Card Header */}
      <div className={`p-6 bg-gradient-to-r ${config.gradient}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${config.color}20` }}>
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-lg">{scenario.title}</h3>
                {adopted && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ color: config.color, background: `${config.color}20` }}>
                    <CheckCircle2 className="w-3 h-3" /> Adopted
                  </span>
                )}
              </div>
              <p className="text-white/50 text-sm">{scenario.tagline}</p>
            </div>
          </div>
          <RiskMeter level={scenario.risk_level} color={config.color} />
        </div>

        {/* Rationale + Expected Outcome */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-black/20 border border-white/[0.06]">
            <p className="text-white/30 text-xs mb-1 uppercase tracking-wider">Why this strategy?</p>
            <p className="text-white/70 text-sm leading-relaxed">{scenario.rationale}</p>
          </div>
          <div className="p-3 rounded-xl bg-black/20 border border-white/[0.06]">
            <p className="text-white/30 text-xs mb-1 uppercase tracking-wider">Expected outcome</p>
            <p className="text-white/70 text-sm leading-relaxed">{scenario.expected_outcome}</p>
          </div>
        </div>

        {/* Strategy basis */}
        <div className="mt-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
          <p className="text-white/30 text-xs italic">{scenario.strategy_basis}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-sm text-white/60 hover:text-white/80 transition-colors mb-3"
        >
          <span className="font-medium">
            {scenario.actions.length} recommended actions
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-2 mb-4">
                {scenario.actions.map((action, i) => (
                  <ActionRow key={i} action={action} color={config.color} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!expanded && (
          <div className="flex flex-wrap gap-2 mb-4">
            {scenario.actions.map((a, i) => (
              <ActionChip key={i} action={a} />
            ))}
          </div>
        )}

        {/* Adopt Button */}
        <Button
          onClick={() => { onAdopt(); setExpanded(true) }}
          disabled={adopted}
          className="micro-jiggle w-full h-11 rounded-2xl font-medium transition-all"
          style={adopted
            ? { background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}40` }
            : { background: config.color, color: 'white' }
          }
        >
          {adopted ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Strategy Adopted — Follow the steps above</>
          ) : (
            <>Adopt This Strategy <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

function ActionRow({ action, color }: { action: RebalancingAction; color: string }) {
  const [showExplanation, setShowExplanation] = useState(false)
  const actionColors = { buy: '#D6D3D1', sell: '#F43F5E', hold: '#A8A29E' }
  const actionColor = actionColors[action.action]

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-white/75 text-xs font-bold">{action.ticker.slice(0, 4)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">{action.ticker}</span>
            <span className="text-xs px-2 py-0.5 rounded-full uppercase font-semibold" style={{ color: actionColor, background: `${actionColor}15` }}>
              {action.action}
            </span>
          </div>
          <p className="text-white/40 text-xs truncate">{action.reason}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {action.action !== 'hold' && (
            <p className="text-white/60 text-xs font-medium">
              {action.action === 'sell' ? '-' : '+'}{Math.abs(action.target_pct - action.current_pct).toFixed(1)}%
            </p>
          )}
          {action.estimated_amount > 0 && action.action !== 'hold' && (
            <p className="text-white/30 text-xs">${action.estimated_amount.toFixed(0)}</p>
          )}
        </div>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/30 hover:text-white/50"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              <div className="p-2.5 rounded-lg border text-xs text-white/60 leading-relaxed" style={{ borderColor: `${color}20`, background: `${color}08` }}>
                💡 {action.beginner_explanation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ActionChip({ action }: { action: RebalancingAction }) {
  const actionColors = { buy: '#D6D3D1', sell: '#F43F5E', hold: '#A8A29E' }
  const c = actionColors[action.action]
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ color: c, borderColor: `${c}30`, background: `${c}10` }}>
      <span className="uppercase font-semibold">{action.action}</span>
      <span className="text-white/60">{action.ticker}</span>
    </span>
  )
}

function RiskMeter({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex-shrink-0 text-center">
      <p className="text-white/30 text-xs mb-1">Risk level</p>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-4 rounded-sm transition-all"
            style={i < level ? { background: color } : { background: 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>
      <p className="text-white/40 text-xs mt-1">{level}/10</p>
    </div>
  )
}

function RebalanceCTA({ onRun }: { onRun: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass apple-surface rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <Shuffle className="w-8 h-8 text-white/75" />
      </div>
      <h2 className="text-white font-bold text-xl mb-2">Ready to Optimize Your Portfolio?</h2>
      <p className="text-white/40 text-sm max-w-md mx-auto mb-6">
        Our AI will generate 3 personalized rebalancing strategies — Conservative, Moderate, and Aggressive —
        each with specific actions explained in plain English.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mb-8 text-xs text-white/40">
        {['3 tailored strategies', 'Plain-English explanations', 'Specific action steps', 'Advisory only — you decide'].map((f) => (
          <span key={f} className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-white/65" />{f}
          </span>
        ))}
      </div>
      <Button onClick={onRun} className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 px-8 h-11 border border-[#F4EFE4]/30">
        <Shuffle className="w-4 h-4" /> Generate My Strategies
      </Button>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <div className="glass apple-surface rounded-2xl p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
        <Shuffle className="w-7 h-7 text-white/75" />
      </div>
      <h3 className="text-white font-semibold mb-2">Add investments first</h3>
      <p className="text-white/40 text-sm mb-5">You need at least one investment in your portfolio to generate rebalancing strategies.</p>
      <Link href="/portfolio/add">
        <Button className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 border border-[#F4EFE4]/30">
          <Plus className="w-4 h-4" /> Add Investment
        </Button>
      </Link>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 flex items-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/65 rounded-full animate-spin" />
        <div>
          <p className="text-white font-medium">Crafting your strategies...</p>
          <p className="text-white/40 text-sm">Analyzing your holdings and risk profile to generate 3 personalized plans</p>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl bg-white/5" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3 bg-white/5" />
              <Skeleton className="h-3 w-1/2 bg-white/5" />
            </div>
          </div>
          <Skeleton className="h-16 bg-white/5 rounded-xl" />
          <Skeleton className="h-10 bg-white/5 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
