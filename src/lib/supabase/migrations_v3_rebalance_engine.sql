-- Rebalancing Engine V2 schema upgrades
-- Run this after migrations.sql and migrations_v2.sql

-- Contribution cash bucket used by contribution-first optimizer
ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS available_contribution_cash DECIMAL DEFAULT 0;

-- Lot-level holdings for tax-aware optimization
CREATE TABLE IF NOT EXISTS holding_lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  holding_id UUID REFERENCES holdings(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  acquired_at DATE NOT NULL,
  shares_remaining DECIMAL NOT NULL CHECK (shares_remaining >= 0),
  cost_basis_per_share DECIMAL NOT NULL CHECK (cost_basis_per_share >= 0),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holding_lots_holding_id ON holding_lots(holding_id);
CREATE INDEX IF NOT EXISTS idx_holding_lots_portfolio_ticker ON holding_lots(portfolio_id, ticker);

-- Deterministic recommendation envelope for auditability
CREATE TABLE IF NOT EXISTS rebalance_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('threshold', 'calendar', 'hybrid')),
  trigger_reason TEXT,
  snapshot_json JSONB NOT NULL,
  diagnostics_json JSONB NOT NULL,
  queue_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rebalance_reco_user_portfolio ON rebalance_recommendations(user_id, portfolio_id);

-- Deterministic trade queue rows
CREATE TABLE IF NOT EXISTS rebalance_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID REFERENCES rebalance_recommendations(id) ON DELETE CASCADE NOT NULL,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('conservative', 'moderate', 'aggressive')),
  rank INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'hold')),
  dollars DECIMAL NOT NULL CHECK (dollars >= 0),
  shares_estimate DECIMAL,
  current_pct DECIMAL,
  target_pct DECIMAL,
  impact_score DECIMAL NOT NULL,
  tax_note TEXT,
  reason TEXT NOT NULL,
  explanation TEXT,
  lot_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rebalance_trades_reco ON rebalance_trades(recommendation_id);

-- Backfill: create synthetic lots for existing holdings that have none.
INSERT INTO holding_lots (holding_id, portfolio_id, ticker, acquired_at, shares_remaining, cost_basis_per_share, source)
SELECT
  h.id,
  h.portfolio_id,
  h.ticker,
  COALESCE(h.purchase_date, CURRENT_DATE),
  h.shares,
  h.avg_cost_basis,
  'backfill_synthetic'
FROM holdings h
LEFT JOIN holding_lots l ON l.holding_id = h.id
WHERE l.id IS NULL
  AND h.shares > 0;

-- RLS
ALTER TABLE holding_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalance_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebalance_trades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'holding_lots' AND policyname = 'Users manage own holding lots'
  ) THEN
    CREATE POLICY "Users manage own holding lots" ON holding_lots
      FOR ALL USING (
        portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rebalance_recommendations' AND policyname = 'Users manage own rebalance recommendations'
  ) THEN
    CREATE POLICY "Users manage own rebalance recommendations" ON rebalance_recommendations
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rebalance_trades' AND policyname = 'Users manage own rebalance trades'
  ) THEN
    CREATE POLICY "Users manage own rebalance trades" ON rebalance_trades
      FOR ALL USING (
        recommendation_id IN (
          SELECT id FROM rebalance_recommendations WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

