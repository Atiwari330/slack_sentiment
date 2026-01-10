-- Migration: Add timeline and conversation state columns to sentiment_results
-- Run this in Supabase SQL Editor if you have an existing database

-- Add timeline column (stores array of timeline events)
ALTER TABLE sentiment_results
ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]';

-- Add conversation_state column (stores current state info)
ALTER TABLE sentiment_results
ADD COLUMN IF NOT EXISTS conversation_state JSONB;

-- Add urgency column for quick filtering
ALTER TABLE sentiment_results
ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low';

-- Create index for urgency-based filtering
CREATE INDEX IF NOT EXISTS idx_sentiment_urgency ON sentiment_results(urgency);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sentiment_results'
ORDER BY ordinal_position;
