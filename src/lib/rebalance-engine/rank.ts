import type { OptimizedTrade } from '@/lib/rebalance-engine/types'

export function rankByImpactPerDollar(trades: OptimizedTrade[]): OptimizedTrade[] {
  return [...trades]
    .map((t) => {
      const dollars = t.dollars > 0 ? t.dollars : 1
      const impactPerDollar = t.impact_score / dollars
      return { ...t, impact_score: Number(impactPerDollar.toFixed(10)) }
    })
    .sort((a, b) => b.impact_score - a.impact_score)
}

