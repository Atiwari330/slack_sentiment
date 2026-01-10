import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key (full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types for our database tables
export interface Account {
  id: string;
  name: string;
  slack_channel_id: string;
  slack_channel_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Timeline event stored in JSONB
export interface TimelineEventDb {
  timestamp: string;
  eventType: string;
  actor: "customer" | "vendor";
  summary: string;
}

// Conversation state stored in JSONB
export interface ConversationStateDb {
  status: string;
  description: string;
  customerWaitingHours: number | null;
  lastVendorResponseHours: number | null;
  urgency: string;
}

export interface SentimentResult {
  id: string;
  account_id: string;
  analyzed_at: string;
  sentiment: "green" | "yellow" | "red";
  confidence: number | null;
  summary: string;
  risk_factors: string[] | null;
  positive_signals: string[] | null;
  message_count: number | null;
  days_analyzed: number;
  timeline: TimelineEventDb[] | null;
  conversation_state: ConversationStateDb | null;
  urgency: "low" | "medium" | "high" | "critical" | null;
}

export interface AccountWithSentiment extends Account {
  latest_sentiment: "green" | "yellow" | "red" | null;
  latest_summary: string | null;
  last_analyzed: string | null;
  confidence: number | null;
  risk_factors: string[] | null;
  timeline: TimelineEventDb[] | null;
  conversation_state: ConversationStateDb | null;
  urgency: "low" | "medium" | "high" | "critical" | null;
}
