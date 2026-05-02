'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AllocationChart } from '@/components/charts/allocation-chart'
import { GlossaryTooltip } from '@/components/shared/glossary-tooltip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Brain, Lightbulb, Plus,
  RefreshCw, ChevronRight, Shield, Sparkles
} from 'lucide-react'
import Link from 'next/link'
import type { PortfolioAnalysis } from '@/types'

export default function AnalysisPage() {
  const supabase = createClient()
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [portfolioId, setPortfolioId] = useState<string | null>(null)
  const [hasHoldings, setHasHoldings] = useState(false)
  const [ran, setRan] = useState(false)

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

  async function runAnalysis() {
    if (!portfolioId) return
    setLoading(true)
    setRan(true)
    try {
      const res = await fetch('/api/ai/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_id: portfolioId }),
      })
      const data = await res.json()
      setAnalysis(data)
    } finally {
      setLoading(false)
    }
  }

  const sectorData = analysis
    ? Object.entries(analysis.sector_concentration)
      .map(([name, value]) => ({ name, value: typeof value === 'number' ? value : Number(value) }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0)
    : []

  const healthColor = analysis
    ? analysis.health_score >= 70 ? '#10B981' : analysis.health_score >= 40 ? '#A8A29E' : '#F43F5E'
    : '#D6D3D1'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Analysis</h1>
            <p className="text-white/40 text-sm mt-0.5">Personalized insights powered by AI</p>
          </div>
          {hasHoldings && (
            <Button
              onClick={runAnalysis}
              disabled={loading}
              className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 h-10 border border-[#F4EFE4]/30"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Brain className="w-4 h-4" /> {ran ? 'Refresh' : 'Analyze Portfolio'}</>
              )}
            </Button>
          )}
        </div>

        {!hasHoldings ? (
          <div className="glass apple-surface rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-7 h-7 text-white/80" />
            </div>
            <h3 className="text-white font-semibold mb-2">Add investments first</h3>
            <p className="text-white/40 text-sm mb-5">Add some stocks or ETFs to get personalized AI analysis of your portfolio.</p>
            <Link href="/portfolio/add">
              <Button className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 border border-[#F4EFE4]/30">
                <Plus className="w-4 h-4" /> Add Investment
              </Button>
            </Link>
          </div>
        ) : !ran ? (
          <AnalysisCTA onRun={runAnalysis} />
        ) : loading ? (
          <LoadingSkeleton />
        ) : analysis && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Health Score */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="glass apple-surface rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                  <p className="text-white/40 text-sm mb-4">Portfolio Health</p>
                  <div className="relative w-28 h-28 mb-3">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={healthColor}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - analysis.health_score / 100)}`}
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-3xl font-bold text-white">{analysis.health_score}</span>
                      <span className="text-white/30 text-xs">/ 100</span>
                    </div>
                  </div>
                  <p className="text-white/60 text-xs leading-relaxed">{analysis.risk_assessment}</p>
                </div>

                {/* Sector Chart */}
                <div className="glass apple-surface rounded-2xl p-5">
                  <p className="text-white/60 text-sm font-medium mb-1">Sector <GlossaryTooltip term="allocation" /></p>
                  {sectorData.length > 0 && <AllocationChart data={sectorData} />}
                </div>
              </div>

              {analysis.top_risks.length > 0 && (
                <div className="glass apple-surface rounded-2xl p-5">
                  <p className="text-white/60 text-sm font-medium mb-3">Key risks</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.top_risks.map((risk, i) => (
                      <span key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/75">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              <div className="glass apple-surface rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-white/70" />
                  <h3 className="text-white font-semibold">Personalized Insights</h3>
                </div>
                <div className="space-y-3">
                  {analysis.insights.map((insight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white/80 text-xs font-bold">{i + 1}</span>
                      </div>
                      <p className="text-white/75 text-sm leading-relaxed">{insight}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Suggested Additions */}
              {analysis.suggested_additions?.length > 0 && (
                <div className="glass apple-surface rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-white/70" />
                    <h3 className="text-white font-semibold">Suggested Investments</h3>
                    <span className="text-white/30 text-xs ml-1">based on your profile & gaps</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analysis.suggested_additions.map((s, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/12 hover:border-white/25 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-white font-bold text-sm">{s.ticker}</span>
                            <span className="text-white/30 text-xs ml-2 uppercase bg-white/5 px-1.5 py-0.5 rounded">{s.asset_type}</span>
                          </div>
                          <RiskBadge level={s.risk_level} />
                        </div>
                        <p className="text-white/50 text-xs truncate mb-1">{s.company_name}</p>
                        <p className="text-white/60 text-xs leading-relaxed">{s.reason}</p>
                        <Link href={`/portfolio/add?ticker=${s.ticker}`}>
                          <div className="flex items-center gap-1 mt-3 text-white/75 text-xs hover:underline cursor-pointer">
                            Add to portfolio <ChevronRight className="w-3 h-3" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA to Rebalance */}
              <Link href="/rebalance">
                <div className="glass-hover rounded-2xl p-5 flex items-center gap-4 cursor-pointer">
                  <div className="w-11 h-11 rounded-xl bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Ready to optimize?</p>
                    <p className="text-white/40 text-sm mt-0.5">Get 3 personalized rebalancing strategies based on this analysis</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30" />
                </div>
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  )
}

function AnalysisCTA({ onRun }: { onRun: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
        <Brain className="w-8 h-8 text-white/75" />
      </div>
      <h2 className="text-white font-bold text-xl mb-2">Get Your Portfolio Analysis</h2>
      <p className="text-white/40 text-sm max-w-md mx-auto mb-6">
        Our AI will analyze your holdings, calculate your risk score, identify potential issues, and suggest improvements — all explained in plain English.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mb-8 text-xs text-white/40">
        {['Risk score', 'Sector concentration', 'Personalized insights', 'Investment suggestions'].map((f) => (
          <span key={f} className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-white/60" />{f}
          </span>
        ))}
      </div>
      <Button onClick={onRun} className="micro-jiggle bg-[#ECE6DB] hover:bg-[#E2DBCE] text-[#1E1A18] rounded-2xl gap-2 px-8 h-11 border border-[#F4EFE4]/30">
        <Brain className="w-4 h-4" /> Analyze My Portfolio
      </Button>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 flex items-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/65 rounded-full animate-spin" />
        <div>
          <p className="text-white font-medium">Analyzing your portfolio...</p>
          <p className="text-white/40 text-sm">Our AI is reviewing your holdings and risk profile</p>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-2xl p-6 space-y-3">
          <Skeleton className="h-4 w-1/3 bg-white/5" />
          <Skeleton className="h-3 w-full bg-white/5" />
          <Skeleton className="h-3 w-4/5 bg-white/5" />
        </div>
      ))}
    </div>
  )
}

function RiskBadge({ level }: { level: number }) {
  const color = level <= 3 ? '#A8A29E' : level <= 6 ? '#78716C' : '#F43F5E'
  const label = level <= 3 ? 'Low' : level <= 6 ? 'Med' : 'High'
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color, background: `${color}20` }}>
      {label} risk
    </span>
  )
}
