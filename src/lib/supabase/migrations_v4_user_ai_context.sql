-- User AI context persistence for cross-feature personalization
-- Run after migrations.sql, migrations_v2.sql, migrations_v3_rebalance_engine.sql

CREATE TABLE IF NOT EXISTS user_ai_contexts (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  profile_fingerprint TEXT NOT NULL,
  holdings_fingerprint TEXT NOT NULL,
  context_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_context_portfolio ON user_ai_contexts(portfolio_id);

ALTER TABLE user_ai_contexts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_ai_contexts' AND policyname = 'Users manage own ai context'
  ) THEN
    CREATE POLICY "Users manage own ai context" ON user_ai_contexts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

