-- Voice Email Assistant Tables
-- Run this in your Supabase SQL Editor

-- Contacts knowledge base for email composition
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  role TEXT,
  context TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contacts_search ON contacts
  USING gin(to_tsvector('english', name || ' ' || email || ' ' || COALESCE(company, '')));

-- Company info (key-value store for context)
CREATE TABLE company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT,
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
