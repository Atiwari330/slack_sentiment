-- Migration: Add account_actions table for Morning Briefing feature
-- Run this in your Supabase SQL Editor

-- Account actions table: Tracks actions taken on accounts from briefing or manual
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

-- Enable Row Level Security
ALTER TABLE account_actions ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role has full access to account_actions" ON account_actions
  FOR ALL USING (true);

-- Optional: Add account_id column to existing tables if linking is desired
-- (These are optional modifications mentioned in the plan)
-- ALTER TABLE brain_dump_runs ADD COLUMN account_id UUID REFERENCES accounts(id);
-- ALTER TABLE email_drafts ADD COLUMN account_id UUID REFERENCES accounts(id);
