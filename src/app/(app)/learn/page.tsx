'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

const GLOSSARY = [
  { term: 'Stock', category: 'Basics', definition: 'A tiny piece of ownership in a company. When you buy a stock, you become a partial owner and share in the company\'s successes and failures.', example: 'Buying 1 share of Apple means you own a very small part of Apple Inc.' },
  { term: 'ETF (Exchange-Traded Fund)', category: 'Basics', definition: 'A basket of many stocks bundled together that you can buy as a single investment. ETFs give you instant diversification.', example: 'SPY is an ETF that holds all 500 companies in the S&P 500 index.' },
  { term: 'Portfolio', category: 'Basics', definition: 'Your complete collection of investments — all your stocks, ETFs, bonds, and other assets together.', example: 'Your portfolio might have 60% stocks, 30% ETFs, and 10% bonds.' },
  { term: 'Diversification', category: 'Strategy', definition: 'Spreading your money across different investments so that if one goes down, the others can cushion the blow. Think of it as not putting all your eggs in one basket.', example: 'Instead of putting all your money in one tech company, spread it across tech, healthcare, and finance.' },
  { term: 'Rebalancing', category: 'Strategy', definition: 'Adjusting your investments to bring them back to your original target percentages. Over time, some investments grow faster, throwing off your balance.', example: 'If stocks grow from 60% to 75% of your portfolio, rebalancing means selling some stocks to get back to 60%.' },
  { term: 'Risk Tolerance', category: 'Strategy', definition: 'How comfortable you are with the possibility of your investments losing value temporarily in exchange for higher potential long-term gains.', example: 'A conservative investor sleeps well with 5% annual returns. An aggressive investor can handle a -30% drop if it means 15% average returns.' },
  { term: 'Asset Allocation', category: 'Strategy', definition: 'How you divide your money between different types of investments like stocks, bonds, and cash. Your age and goals should guide this.', example: 'A common rule: subtract your age from 110 to get your stock percentage. Age 30 → 80% stocks, 20% bonds.' },
  { term: 'Bull Market', category: 'Market Terms', definition: 'When stock prices are rising or expected to rise. Named after a bull thrusting its horns upward. Markets generally go up over long periods.', example: 'The US had one of the longest bull markets in history from 2009 to 2020.' },
  { term: 'Bear Market', category: 'Market Terms', definition: 'When stock prices fall 20% or more from recent highs. Named after a bear swiping its paw downward. These are temporary but scary.', example: 'During COVID in March 2020, markets dropped 34% in 33 days — that was a bear market.' },
  { term: 'Dividend', category: 'Returns', definition: 'A cash payment companies make to shareholders from their profits. It\'s like getting paid to own a stock.', example: 'If you own 100 shares of a company paying $1/share in dividends, you receive $100 every quarter.' },
  { term: 'P/E Ratio', category: 'Valuation', definition: 'Price-to-Earnings ratio — compares a stock\'s price to its annual profits. Lower can mean better value, higher can mean overpriced or high-growth expectations.', example: 'A P/E of 15 means you\'re paying $15 for every $1 of the company\'s annual earnings.' },
  { term: 'Market Cap', category: 'Valuation', definition: 'The total value of all a company\'s shares — a measure of the company\'s size. Small-cap companies are riskier but can grow faster.', example: 'Apple has a market cap over $3 trillion, making it one of the world\'s most valuable companies.' },
  { term: 'Cost Basis', category: 'Tax & Math', definition: 'The original price you paid for an investment. Used to calculate your profit or loss when you sell.', example: 'If you bought AAPL at $150 and it\'s now $180, your cost basis is $150 and your gain is $30/share.' },
  { term: 'Dollar-Cost Averaging', category: 'Strategy', definition: 'Investing a fixed amount regularly regardless of price — buying more shares when prices are low and fewer when prices are high. Removes emotion from investing.', example: 'Investing $200 every month in an index fund, no matter what the market is doing.' },
  { term: 'Index Fund', category: 'Basics', definition: 'A type of ETF or mutual fund that tracks a market index like the S&P 500. Low fees, instant diversification, and historically hard to beat.', example: 'VTI tracks the entire US stock market — over 4,000 companies in one fund.' },
  { term: 'Bond', category: 'Basics', definition: 'A loan you make to a government or company. They pay you back with interest. Safer than stocks but lower returns.', example: 'Buying a US Treasury bond is like lending money to the US government. Very safe.' },
  { term: 'Volatility', category: 'Risk', definition: 'How much an investment\'s price moves up and down. High volatility = wild swings. Low volatility = steadier prices.', example: 'Crypto is highly volatile — it can gain or lose 20% in a week. Government bonds are low volatility.' },
  { term: 'Liquidity', category: 'Basics', definition: 'How quickly and easily you can turn an investment back into cash without losing much value.', example: 'Stocks listed on major exchanges are highly liquid. Real estate is not — selling a house takes months.' },
  { term: 'Compound Interest', category: 'Returns', definition: 'Earning returns on your returns. Over time, this snowball effect is one of the most powerful forces in investing.', example: '$10,000 at 8% for 30 years becomes $100,000+ without adding a single dollar — just from compounding.' },
  { term: 'Sector', category: 'Basics', definition: 'A group of companies in the same industry. The stock market is divided into 11 sectors like Technology, Healthcare, and Financials.', example: 'Apple, Microsoft, and Google are all in the Technology sector.' },
]

const CATEGORIES = ['All', ...Array.from(new Set(GLOSSARY.map((g) => g.category)))]

const EXPLAINERS = [
  {
    title: 'What is Rebalancing?',
    icon: '⚖️',
    content: `Imagine you planted a garden with equal amounts of tomatoes, peppers, and basil. After a summer, tomatoes went wild and now take up 70% of the space. Rebalancing is like pruning back the tomatoes and giving peppers and basil more room — restoring your original plan.

In investing, rebalancing means selling some of what has grown too large and buying more of what has shrunk. This might feel counterintuitive (selling your winners!), but it enforces the best investing habit: sell high, buy low.

**When should you rebalance?**
• Calendar method: Review quarterly or annually
• Threshold method: Rebalance when any investment drifts more than 5-10% from its target
• Hybrid (best practice): Annual review + rebalance if something drifts over 10%`,
  },
  {
    title: 'Understanding Risk',
    icon: '🎯',
    content: `Risk in investing means the chance that your investments lose value. But here's what many beginners miss: NOT investing is also risky — the risk of inflation slowly eroding your savings.

The key insight is that risk and return are linked. To get higher returns over time, you have to accept more short-term volatility.

**Your risk tolerance depends on:**
• Time horizon: More time = can take more risk (market recovers)
• Income stability: Stable job = can handle more risk
• Dependents: Kids to support = may want less risk
• Sleep test: Can you sleep if your portfolio drops 30%?

**Conservative:** Mostly bonds & stable ETFs. Slow growth, low stress.
**Moderate:** Mix of stocks and bonds. Balanced approach.
**Aggressive:** Mostly stocks. Bigger swings, but historically higher long-term returns.`,
  },
  {
    title: 'The Power of Diversification',
    icon: '🌍',
    content: `In 2001, Enron employees who had their entire retirement in company stock lost everything when Enron collapsed. That's the extreme version of not diversifying.

Diversification doesn't mean owning 50 stocks. It means owning investments that don't all rise and fall together.

**Diversify across:**
• Companies: Don't bet everything on one stock
• Sectors: Tech + Healthcare + Finance vs. all tech
• Geography: US + International
• Asset types: Stocks + Bonds + ETFs

**The easy way:** Just buy a total market ETF like VTI. You instantly own thousands of companies.`,
  },
]

export default function LearnPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null)
  const [expandedExplainer, setExpandedExplainer] = useState<number | null>(0)

  const filtered = GLOSSARY.filter((g) => {
    const matchesSearch = !search ||
      g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.definition.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || g.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Learn</h1>
          <p className="text-white/40 text-sm mt-0.5">Investment fundamentals explained in plain English</p>
        </div>

        {/* Explainers */}
        <div className="space-y-3">
          {EXPLAINERS.map((e, i) => (
            <motion.div
              key={e.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedExplainer(expandedExplainer === i ? null : i)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-2xl">{e.icon}</span>
                <span className="text-white font-semibold flex-1">{e.title}</span>
                {expandedExplainer === i ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              </button>
              <AnimatePresence>
                {expandedExplainer === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0 prose prose-invert prose-sm max-w-none">
                      {e.content.split('\n\n').map((para, pi) => (
                        <p key={pi} className="text-white/60 text-sm leading-relaxed mb-3">{para}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Glossary */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-[#4F8EF7]" />
            <h2 className="text-white font-semibold">Glossary</h2>
            <span className="text-white/30 text-sm">{GLOSSARY.length} terms</span>
          </div>

          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search terms..."
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#4F8EF7] h-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === cat
                      ? 'bg-[#4F8EF7]/20 text-[#4F8EF7] border border-[#4F8EF7]/30'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.map((item, i) => (
              <motion.div
                key={item.term}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTerm(expandedTerm === item.term ? null : item.term)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-[#4F8EF7]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#4F8EF7] text-xs font-bold">{item.term[0]}</span>
                    </div>
                    <span className="text-white text-sm font-medium">{item.term}</span>
                    <span className="text-white/25 text-xs bg-white/5 px-2 py-0.5 rounded-full">{item.category}</span>
                  </div>
                  {expandedTerm === item.term ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </button>
                <AnimatePresence>
                  {expandedTerm === item.term && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 space-y-2">
                        <p className="text-white/60 text-sm leading-relaxed">{item.definition}</p>
                        {item.example && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#4F8EF7]/5 border border-[#4F8EF7]/10">
                            <span className="text-[#4F8EF7] text-xs font-medium flex-shrink-0">Example:</span>
                            <span className="text-white/50 text-xs leading-relaxed">{item.example}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-white/30">No terms match your search.</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
