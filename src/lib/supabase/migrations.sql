-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  age INTEGER,
  annual_income DECIMAL,
  employment_type TEXT CHECK (employment_type IN ('employed','self-employed','student','retired','unemployed')),
  marital_status TEXT CHECK (marital_status IN ('single','married','divorced','widowed')),
  num_dependents INTEGER DEFAULT 0,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative','moderate','aggressive')),
  investment_goal TEXT CHECK (investment_goal IN ('retirement','house','emergency','wealth','education')),
  investment_horizon TEXT CHECK (investment_horizon IN ('<1yr','1-5yrs','5-10yrs','10+yrs')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolios
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT 'My Portfolio',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Holdings
CREATE TABLE IF NOT EXISTS holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT,
  shares DECIMAL NOT NULL,
  avg_cost_basis DECIMAL NOT NULL,
  purchase_date DATE,
  asset_type TEXT DEFAULT 'stock' CHECK (asset_type IN ('stock','etf','crypto','bond')),
  sector TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rebalancing sessions
CREATE TABLE IF NOT EXISTS rebalancing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  market_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rebalancing scenarios (3 per session)
CREATE TABLE IF NOT EXISTS rebalancing_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES rebalancing_sessions(id) ON DELETE CASCADE NOT NULL,
  scenario_type TEXT CHECK (scenario_type IN ('conservative','moderate','aggressive')),
  title TEXT,
  tagline TEXT,
  rationale TEXT,
  expected_outcome TEXT,
  risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 10),
  strategy_basis TEXT,
  actions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalancing_scenarios ENABLE ROW LEVEL SECURITY;

-- Profiles: users manage their own
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- Portfolios
CREATE POLICY "Users manage own portfolios" ON portfolios FOR ALL USING (auth.uid() = user_id);

-- Holdings
CREATE POLICY "Users manage own holdings" ON holdings
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  );

-- Rebalancing sessions
CREATE POLICY "Users manage own rebalancing sessions" ON rebalancing_sessions FOR ALL USING (auth.uid() = user_id);

-- Rebalancing scenarios
CREATE POLICY "Users manage own scenarios" ON rebalancing_scenarios
  FOR ALL USING (
    session_id IN (SELECT id FROM rebalancing_sessions WHERE user_id = auth.uid())
  );
