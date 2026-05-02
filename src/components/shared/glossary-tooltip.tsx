'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

const TERMS: Record<string, string> = {
  'P&L': 'Profit & Loss — how much money you\'ve made or lost compared to what you paid.',
  'allocation': 'What percentage of your total portfolio is in each investment.',
  'rebalancing': 'Adjusting your investments to bring them back to your target mix — like trimming a garden.',
  'diversification': 'Spreading money across different investments so one bad apple doesn\'t ruin everything.',
  'risk tolerance': 'How comfortable you are with the possibility of losing money in exchange for higher potential gains.',
  'cost basis': 'The original price you paid for an investment — used to calculate your profit or loss.',
  'sector': 'A group of companies in the same industry, like Technology, Healthcare, or Energy.',
  'ETF': 'Exchange-Traded Fund — a basket of many stocks bundled together, easy to buy like a single stock.',
  'market cap': 'The total value of all a company\'s shares — a measure of how big the company is.',
  'P/E ratio': 'Price-to-Earnings ratio — compares a stock\'s price to its profits. Lower can mean better value.',
  'yield': 'The income (dividends) an investment pays you, shown as a percentage of its price.',
  'portfolio': 'Your complete collection of investments — all your stocks, ETFs, and other assets together.',
}

export function GlossaryTooltip({ term }: { term: string }) {
  const definition = TERMS[term.toLowerCase()] || TERMS[term]
  if (!definition) return <span>{term}</span>

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="inline-flex items-center gap-0.5 cursor-help border-b border-dashed border-white/30 text-white/80">
          {term}
          <HelpCircle className="w-3 h-3 text-white/30" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs bg-[#0A0A0F] border-white/10 text-white/80 text-xs p-3 rounded-xl"
      >
        <p className="font-medium text-white mb-0.5">{term}</p>
        <p>{definition}</p>
      </TooltipContent>
    </Tooltip>
  )
}
