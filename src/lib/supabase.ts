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

// Voice Email Assistant Types
export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  context: string | null;
  tags: string[] | null;
  default_asana_project_id: string | null;
  default_asana_project_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyInfo {
  id: string;
  key: string;
  value: string;
  category: string | null;
  created_at: string;
}

export interface EmailDraft {
  id: string;
  session_id: string;
  version: number;
  status: "draft" | "approved" | "sent" | "cancelled";
  transcription: string;
  contact_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string | null;
  body: string | null;
  feedback: string | null;
  gmail_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface GmailToken {
  id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Brain Dump Types
export interface BrainDumpSlackDraft {
  message: string;
}

export interface BrainDumpAsanaDraft {
  taskTitle: string;
  taskDescription: string;
  subtasks: string[];
}

export interface BrainDumpRun {
  id: string;
  created_at: string;
  input_transcript: string;
  // Slack
  slack_channel_id: string;
  slack_channel_name: string;
  slack_user_id: string | null;
  // Contact (source for Asana project + assignee)
  contact_id: string | null;
  contact_name: string;
  contact_email: string;
  // Asana (derived from contact)
  asana_project_id: string | null;
  asana_project_name: string | null;
  // Drafts
  draft_slack: BrainDumpSlackDraft | null;
  draft_asana: BrainDumpAsanaDraft | null;
  revision_history: Array<{ feedback: string; timestamp: string }>;
  status: "draft" | "slack_sent" | "asana_created" | "complete";
  // Execution results
  final_slack_sent_at: string | null;
  slack_message_ts: string | null;
  final_asana_created_at: string | null;
  asana_task_gid: string | null;
  asana_task_url: string | null;
}

// Account Actions Types (Morning Briefing)
export interface AccountAction {
  id: string;
  account_id: string;
  action_type: "slack_message" | "email" | "asana_task" | "skip";
  trigger_source: "briefing" | "manual";
  suggested_action: string | null;
  issue_summary: string | null;
  executed_message: string | null;
  slack_channel_id: string | null;
  slack_message_ts: string | null;
  status: "suggested" | "executed" | "skipped";
  sentiment_at_action: string | null;
  urgency_at_action: string | null;
  skip_reason: string | null;
  created_at: string;
  executed_at: string | null;
}
