import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, Brain, Shuffle, BookOpen, Shield,
  ArrowRight, CheckCircle2, Star
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-mesh overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#4F8EF7] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">NestEgg</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/signin">
            <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl">
              Get started free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 text-[#4F8EF7] text-sm mb-8">
          <Star className="w-3.5 h-3.5" />
          Goldman Sachs Hackathon — Empowering the Everyday Investor
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
          Invest confidently,<br />
          <span className="gradient-text">even as a beginner.</span>
        </h1>

        <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          NestEgg tracks your portfolio, explains every financial term in plain English,
          and gives you AI-powered advice to grow your wealth — no Wall Street degree needed.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl px-8 h-12 text-base gap-2 glow-blue">
              Start for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="outline" className="border-white/15 text-white/70 hover:bg-white/5 hover:text-white rounded-xl px-8 h-12 text-base">
              Sign in
            </Button>
          </Link>
        </div>

        <p className="text-white/25 text-sm mt-4">No credit card required · For educational purposes only</p>

        {/* Mock Dashboard Preview */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0A0A0F] z-10 pointer-events-none" />
          <div className="glass rounded-2xl p-6 mx-auto max-w-4xl border border-white/[0.08] overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-[#F43F5E]/60" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
              <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
              <div className="flex-1 mx-4 h-6 bg-white/5 rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2 bg-[#4F8EF7]/5 border border-[#4F8EF7]/10 rounded-xl p-4">
                <p className="text-white/30 text-xs mb-1">Total Portfolio Value</p>
                <p className="text-white text-3xl font-bold">$24,830.50</p>
                <p className="text-[#10B981] text-sm mt-1">+$2,340.20 (+10.4%) all time</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                <p className="text-white/30 text-xs">Risk Profile</p>
                <div>
                  <p className="text-white font-semibold">Moderate</p>
                  <p className="text-white/40 text-xs">Balanced growth</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { ticker: 'AAPL', name: 'Apple Inc.', value: '$8,240', change: '+2.3%', pct: '33%', color: '#4F8EF7' },
                { ticker: 'MSFT', name: 'Microsoft', value: '$5,680', change: '+1.8%', pct: '23%', color: '#10B981' },
                { ticker: 'SPY', name: 'S&P 500 ETF', value: '$4,920', change: '+0.9%', pct: '20%', color: '#a78bfa' },
              ].map((s) => (
                <div key={s.ticker} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                      <span className="text-xs font-bold" style={{ color: s.color }}>{s.ticker.slice(0,3)}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{s.ticker}</p>
                      <p className="text-white/30 text-xs">{s.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[#10B981] text-sm font-medium">{s.change}</span>
                    <span className="text-white/60 text-sm">{s.value}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-white/10 rounded-full">
                        <div className="h-full rounded-full" style={{ width: s.pct, background: s.color }} />
                      </div>
                      <span className="text-white/30 text-xs w-8">{s.pct}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Everything a new investor needs</h2>
          <p className="text-white/40 max-w-xl mx-auto">No confusing charts, no intimidating jargon. Just clear insights that help you make better financial decisions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: TrendingUp, color: '#4F8EF7', title: 'Portfolio Tracking', desc: 'See all your investments in one place with live prices, P&L, and sector breakdown.' },
            { icon: Brain, color: '#a78bfa', title: 'AI-Powered Analysis', desc: 'Get a personalized portfolio health score, risk assessment, and actionable insights based on your life situation.' },
            { icon: Shuffle, color: '#10B981', title: 'Smart Rebalancing', desc: 'Choose from 3 AI-generated strategies — Conservative, Moderate, or Aggressive — with plain-English explanations.' },
            { icon: BookOpen, color: '#f59e0b', title: 'Learn as You Go', desc: 'Every financial term is explained in plain English. Hover over any concept to understand it instantly.' },
            { icon: Shield, color: '#F43F5E', title: 'Risk-Aware Advice', desc: 'All recommendations are tailored to your age, income, family situation, and how much risk you can handle.' },
            { icon: CheckCircle2, color: '#06b6d4', title: 'Advisory Only', desc: "We tell you exactly what to do — but you're always in control. No automated trades, no surprises." },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="glass-hover rounded-2xl p-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Start in 5 minutes</h2>
          <p className="text-white/40">No financial background required</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { num: '1', title: 'Create account', desc: 'Sign up in seconds' },
            { num: '2', title: 'Tell us about you', desc: 'Age, goals, risk comfort' },
            { num: '3', title: 'Add your investments', desc: 'Connect or add manually' },
            { num: '4', title: 'Get your plan', desc: 'AI analysis + strategies' },
          ].map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#4F8EF7]/15 border border-[#4F8EF7]/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-[#4F8EF7] font-bold text-lg">{step.num}</span>
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
              <p className="text-white/35 text-xs">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="glass rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-[#4F8EF7]/10 rounded-full blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to invest smarter?</h2>
            <p className="text-white/45 mb-8 max-w-md mx-auto">Join thousands of everyday investors growing their wealth with confidence.</p>
            <Link href="/signup">
              <Button size="lg" className="bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl px-10 h-12 text-base gap-2 glow-blue">
                Start for free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <p className="text-white/20 text-sm mt-4">Educational purposes only. Not financial advice.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4F8EF7] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-white/60 font-semibold text-sm">NestEgg</span>
          </div>
          <p className="text-white/25 text-xs">Goldman Sachs Hackathon 2026 · For educational purposes only</p>
        </div>
      </footer>
    </div>
  )
}
