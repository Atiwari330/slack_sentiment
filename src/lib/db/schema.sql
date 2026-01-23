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

-- =====================================================
-- Voice Email Assistant Tables
-- =====================================================

-- Contacts knowledge base for email composition
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT,
  context TEXT,                    -- "CEO at Acme, prefers formal tone"
  tags TEXT[],                     -- ["client", "priority"]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index on contacts
CREATE INDEX idx_contacts_search ON contacts
  USING gin(to_tsvector('english', name || ' ' || email || ' ' || COALESCE(company, '')));

-- Company info (key-value store for context)
CREATE TABLE company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,        -- "company_name", "product_name"
  value TEXT NOT NULL,
  category TEXT,                   -- "general", "product", "team"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email drafts (history + revision tracking)
CREATE TABLE email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK (status IN ('draft', 'approved', 'sent', 'cancelled')),
  transcription TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT,
  body TEXT,
  feedback TEXT,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding drafts by session
CREATE INDEX idx_email_drafts_session ON email_drafts(session_id, version DESC);

-- Gmail OAuth tokens (encrypted)
CREATE TABLE gmail_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Service role policies for new tables
CREATE POLICY "Service role access" ON contacts FOR ALL USING (true);
CREATE POLICY "Service role access" ON company_info FOR ALL USING (true);
CREATE POLICY "Service role access" ON email_drafts FOR ALL USING (true);
CREATE POLICY "Service role access" ON gmail_tokens FOR ALL USING (true);

-- =====================================================
-- Morning Briefing / Account Actions Tables
-- =====================================================

-- Account actions: Tracks actions taken on accounts from briefing or manual triggers
CREATE TABLE account_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('slack_message', 'email', 'asana_task', 'skip')),
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('briefing', 'manual')),
  suggested_action TEXT,
  issue_summary TEXT,
  executed_message TEXT,
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'executed', 'skipped')),
  sentiment_at_action TEXT,
  urgency_at_action TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Index for fast lookups by account
CREATE INDEX idx_account_actions_account ON account_actions(account_id, created_at DESC);

-- Enable RLS and policy
ALTER TABLE account_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to account_actions" ON account_actions FOR ALL USING (true);

-- =====================================================
-- Inbox Assistant Tables
-- =====================================================

-- Inbox drafts: Reply drafts created by the inbox assistant
CREATE TABLE inbox_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK (status IN ('draft', 'approved', 'sent', 'cancelled')),
  transcription TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  original_message_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  thread_context TEXT,
  feedback TEXT,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding drafts by session
CREATE INDEX idx_inbox_drafts_session ON inbox_drafts(session_id, version DESC);

-- Enable RLS and policy
ALTER TABLE inbox_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access" ON inbox_drafts FOR ALL USING (true);
