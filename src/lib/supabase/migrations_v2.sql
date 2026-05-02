-- Run this in your Supabase SQL editor (run AFTER migrations.sql)
-- Adds enhanced profile fields for IPS generation

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS risk_archetype TEXT
    CHECK (risk_archetype IN ('conservative','moderately_conservative','moderate','moderately_aggressive','aggressive')),
  ADD COLUMN IF NOT EXISTS emergency_fund TEXT
    CHECK (emergency_fund IN ('none','less_3mo','3_6mo','6mo_plus')),
  ADD COLUMN IF NOT EXISTS debt_type TEXT
    CHECK (debt_type IN ('none','student_loans','credit_cards','mortgage','multiple')),
  ADD COLUMN IF NOT EXISTS experience_level TEXT
    CHECK (experience_level IN ('total_beginner','read_about_it','traded_before','experienced')),
  ADD COLUMN IF NOT EXISTS tax_bracket TEXT
    CHECK (tax_bracket IN ('under_44k','44_89k','89_190k','190k_plus')),
  ADD COLUMN IF NOT EXISTS has_near_term_expenses BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS investment_policy_statement TEXT,
  ADD COLUMN IF NOT EXISTS target_stock_pct INTEGER,
  ADD COLUMN IF NOT EXISTS target_bond_pct INTEGER,
  ADD COLUMN IF NOT EXISTS target_cash_pct INTEGER;
