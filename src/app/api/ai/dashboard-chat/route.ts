import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai/client'
import { createClient } from '@/lib/supabase/server'
import { getNewsForTickers, searchTickers } from '@/lib/market-data/yahoo'
import { getOrBuildUserAiContext } from '@/lib/personalization/user-context'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type DashboardChatRequest = {
  message?: string
  portfolio_id?: string
  history?: ChatMessage[]
  twitter_handles?: string[]
  twitter_notes?: string
  social_links?: string[]
  social_notes?: string
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function classifySocialLinks(links: string[]) {
  const xLinks = links.filter((link) => /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\//i.test(link))
  const redditLinks = links.filter((link) => /^(https?:\/\/)?(www\.)?reddit\.com\//i.test(link))
  return { xLinks, redditLinks }
}

function extractQuestionTickers(question: string): string[] {
  const stopwords = new Set([
    'THE', 'AND', 'FOR', 'WITH', 'FROM', 'THIS', 'THAT', 'WHAT', 'WHEN', 'HOW', 'WHY', 'YOUR',
    'HOLD', 'SELL', 'BUY', 'RISK', 'NEWS', 'ABOUT', 'TODAY', 'WEEK', 'MONTH', 'YEAR', 'MY',
  ])
  const raw = question.toUpperCase().match(/\$?[A-Z]{1,5}\b/g) || []
  return Array.from(
    new Set(
      raw
        .map((t) => t.replace('$', '').trim())
        .filter((t) => t.length >= 1 && t.length <= 5 && !stopwords.has(t))
    )
  ).slice(0, 6)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as DashboardChatRequest
  const question = (body.message || '').trim()
  if (!question) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const context = await getOrBuildUserAiContext({
    supabase,
    userId: user.id,
    portfolioId: body.portfolio_id || null,
  })
  const profile = context.profile
  const portfolioId = context.portfolio_id
  const holdingTickers = context.holdings.map((h) => h.ticker.toUpperCase())
  const questionTickers = extractQuestionTickers(question)
  const searchMatches = await searchTickers(question)
  const searchedTickers = searchMatches.map((m) => m.ticker.toUpperCase()).slice(0, 4)
  const newsTickers = Array.from(new Set([...holdingTickers, ...questionTickers, ...searchedTickers])).slice(0, 10)

  const emptyNews: Awaited<ReturnType<typeof getNewsForTickers>> = []

  const news = newsTickers.length > 0 ? await getNewsForTickers(newsTickers, 2) : emptyNews
  const holdingsSnapshot = context.holdings_snapshot
  const totalValue = context.total_value
  const policy = context.policy
  const socialLinksFromBody = asArray(body.social_links)
  const socialLinksFromHandles = asArray(body.twitter_handles)
    .map((handle) => `https://x.com/${handle.replace(/^@/, '')}`)
  const socialLinks = Array.from(new Set([...socialLinksFromBody, ...socialLinksFromHandles])).slice(0, 8)
  const socialNotes = (body.social_notes || body.twitter_notes || '').trim().slice(0, 1500)
  const { xLinks, redditLinks } = classifySocialLinks(socialLinks)
  const history = Array.isArray(body.history) ? body.history.slice(-8) : []
  const newsContext = news.slice(0, 14).map((headline) => ({
    ticker: headline.ticker,
    title: headline.title,
    publisher: headline.publisher,
    published_at: headline.published_at,
    url: headline.url,
    source_hint: holdingTickers.includes(headline.ticker.toUpperCase()) ? 'holding' : 'question',
  }))

  const systemPrompt = `You are the user's portfolio copilot inside a dashboard app.
You must be concise, practical, and friendly. Use plain English.
Never claim to execute trades. Never present guarantees. Do not provide legal/tax advice.
If data is missing, say so and give a best-effort answer.

Output requirements:
- Start with a direct answer in 1-2 short paragraphs.
- Then include a section "Suggested next steps" with 3 bullet points.
- If discussing risk, tie it back to the user's stated risk profile.
- Mention relevant recent news headlines when available.
- If X.com/Reddit links or notes are provided, treat them as sentiment signals (not verified facts).
`

  const contextPayload = {
    profile: {
      full_name: profile?.full_name,
      age: profile?.age,
      risk_tolerance: profile?.risk_tolerance,
      risk_archetype: profile?.risk_archetype,
      investment_goal: profile?.investment_goal,
      investment_horizon: profile?.investment_horizon,
      income: profile?.annual_income,
      ips: profile?.investment_policy_statement,
      targets: {
        stock_pct: profile?.target_stock_pct,
        bond_pct: profile?.target_bond_pct,
        cash_pct: profile?.target_cash_pct,
      },
    },
    policy_constraints: policy,
    portfolio: {
      id: portfolioId || null,
      name: context.portfolio_name || null,
      total_value: Number(totalValue.toFixed(2)),
      holdings_count: holdingsSnapshot.length,
      holdings: holdingsSnapshot,
    },
    market_news: newsContext,
    news_context_meta: {
      holding_tickers: holdingTickers,
      question_tickers: questionTickers,
      searched_tickers: searchedTickers,
    },
    social_signals: {
      x_links: xLinks,
      reddit_links: redditLinks,
      all_links: socialLinks,
      notes: socialNotes || null,
    },
    user_question: question,
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 3000) })),
    {
      role: 'user' as const,
      content: `Context JSON:\n${JSON.stringify(contextPayload, null, 2)}`,
    },
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.35,
    messages,
  })

  const answer = completion.choices[0]?.message?.content?.trim()
  return NextResponse.json({
    answer: answer || 'I could not generate a response right now. Please try again.',
    news_count: newsContext.length,
    holdings_count: holdingsSnapshot.length,
  })
}
