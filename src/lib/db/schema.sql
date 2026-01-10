-- Slack Sentiment Analysis Dashboard - Database Schema
-- Run this in your Supabase SQL Editor

-- Accounts table: Maps customer names to Slack channels
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL UNIQUE,
  slack_channel_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sentiment analysis results
CREATE TABLE sentiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('green', 'yellow', 'red')),
  confidence REAL,
  summary TEXT NOT NULL,
  risk_factors JSONB,
  positive_signals JSONB,
  message_count INTEGER,
  days_analyzed INTEGER DEFAULT 1,
  -- Timeline feature columns (added for conversation timeline feature)
  timeline JSONB DEFAULT '[]',
  conversation_state JSONB,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low'
);

-- Index for fast dashboard queries (latest sentiment per account)
CREATE INDEX idx_sentiment_account_date ON sentiment_results(account_id, analyzed_at DESC);

-- Optional: Analysis jobs table for tracking batch runs
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  accounts_processed INTEGER DEFAULT 0,
  accounts_total INTEGER,
  error_message TEXT
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies that allow service role full access
CREATE POLICY "Service role has full access to accounts" ON accounts
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to sentiment_results" ON sentiment_results
  FOR ALL USING (true);

CREATE POLICY "Service role has full access to analysis_jobs" ON analysis_jobs
  FOR ALL USING (true);
