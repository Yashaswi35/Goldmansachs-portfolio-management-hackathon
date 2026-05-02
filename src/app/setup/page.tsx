'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Copy, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SQL = `-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  age INTEGER,
  annual_income DECIMAL,
  employment_type TEXT,
  marital_status TEXT,
  num_dependents INTEGER DEFAULT 0,
  risk_tolerance TEXT,
  investment_goal TEXT,
  investment_horizon TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT 'My Portfolio',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT,
  shares DECIMAL NOT NULL,
  avg_cost_basis DECIMAL NOT NULL,
  purchase_date DATE,
  asset_type TEXT DEFAULT 'stock',
  sector TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rebalancing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  market_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rebalancing_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES rebalancing_sessions(id) ON DELETE CASCADE NOT NULL,
  scenario_type TEXT,
  title TEXT,
  tagline TEXT,
  rationale TEXT,
  expected_outcome TEXT,
  risk_level INTEGER,
  strategy_basis TEXT,
  actions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own portfolios" ON portfolios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own holdings" ON holdings
  FOR ALL USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "Users manage own rebalancing sessions" ON rebalancing_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own scenarios" ON rebalancing_scenarios
  FOR ALL USING (session_id IN (SELECT id FROM rebalancing_sessions WHERE user_id = auth.uid()));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS risk_archetype TEXT,
  ADD COLUMN IF NOT EXISTS emergency_fund TEXT,
  ADD COLUMN IF NOT EXISTS debt_type TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT,
  ADD COLUMN IF NOT EXISTS tax_bracket TEXT,
  ADD COLUMN IF NOT EXISTS has_near_term_expenses BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS investment_policy_statement TEXT,
  ADD COLUMN IF NOT EXISTS target_stock_pct INTEGER,
  ADD COLUMN IF NOT EXISTS target_bond_pct INTEGER,
  ADD COLUMN IF NOT EXISTS target_cash_pct INTEGER;`

export default function SetupPage() {
  const [copied, setCopied] = useState(false)

  function copySQL() {
    navigator.clipboard.writeText(SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#4F8EF7] flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Database Setup Required</h1>
          <p className="text-white/50 text-sm mt-2">
            Your Supabase database needs to be set up before you can use NestEgg.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white font-medium text-sm">Steps to complete setup:</p>
          </div>
          <ol className="space-y-3 text-sm text-white/60">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4F8EF7]/20 text-[#4F8EF7] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span>Go to your <strong className="text-white/80">Supabase Dashboard</strong> → <strong className="text-white/80">SQL Editor</strong> → <strong className="text-white/80">New query</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4F8EF7]/20 text-[#4F8EF7] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <span>Copy the SQL below and paste it into the editor</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4F8EF7]/20 text-[#4F8EF7] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <span>Click <strong className="text-white/80">Run</strong> — you should see &ldquo;Success&rdquo; messages for each statement</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4F8EF7]/20 text-[#4F8EF7] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
              <span>Come back here, sign up again (or use an existing account), and complete onboarding</span>
            </li>
          </ol>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-white/60 text-xs font-mono">migrations.sql</p>
            <Button
              onClick={copySQL}
              size="sm"
              className="bg-[#4F8EF7]/15 hover:bg-[#4F8EF7]/25 text-[#4F8EF7] border border-[#4F8EF7]/20 rounded-lg gap-1.5 h-7 text-xs"
            >
              {copied ? <><CheckCircle2 className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy SQL</>}
            </Button>
          </div>
          <pre className="p-4 text-xs text-white/50 overflow-auto max-h-64 font-mono leading-relaxed">
            {SQL}
          </pre>
        </div>

        <div className="flex gap-3">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button className="w-full bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-white rounded-xl gap-2 h-11">
              Open Supabase Dashboard <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <Link href="/signup" className="flex-1">
            <Button variant="outline" className="w-full border-white/15 text-white/70 hover:bg-white/5 rounded-xl h-11">
              After setup, sign up →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
