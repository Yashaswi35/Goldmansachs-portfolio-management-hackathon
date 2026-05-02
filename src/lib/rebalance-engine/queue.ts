import type { OptimizedTrade } from '@/lib/rebalance-engine/types'
import { rankByImpactPerDollar } from '@/lib/rebalance-engine/rank'

export interface QueueRow extends OptimizedTrade {
  rank: number
}

export function buildTradeQueue(trades: OptimizedTrade[]): QueueRow[] {
  const ranked = rankByImpactPerDollar(trades)
  return ranked.map((t, index) => ({ ...t, rank: index + 1 }))
}

