import {
  supabase,
  SentimentResult,
  TimelineEventDb,
  ConversationStateDb,
} from "@/lib/supabase";

// Store a new sentiment result
export async function storeSentimentResult(
  accountId: string,
  sentiment: "green" | "yellow" | "red",
  summary: string,
  options?: {
    confidence?: number;
    riskFactors?: string[];
    positiveSignals?: string[];
    messageCount?: number;
    daysAnalyzed?: number;
    timeline?: TimelineEventDb[];
    conversationState?: ConversationStateDb;
  }
): Promise<SentimentResult> {
  const { data, error } = await supabase
    .from("sentiment_results")
    .insert({
      account_id: accountId,
      sentiment,
      summary,
      confidence: options?.confidence || null,
      risk_factors: options?.riskFactors || null,
      positive_signals: options?.positiveSignals || null,
      message_count: options?.messageCount || null,
      days_analyzed: options?.daysAnalyzed || 1,
      timeline: options?.timeline || [],
      conversation_state: options?.conversationState || null,
      urgency: options?.conversationState?.urgency || "low",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get latest sentiment for an account
export async function getLatestSentiment(
  accountId: string
): Promise<SentimentResult | null> {
  const { data, error } = await supabase
    .from("sentiment_results")
    .select("*")
    .eq("account_id", accountId)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Get sentiment history for an account
export async function getSentimentHistory(
  accountId: string,
  limit: number = 30
): Promise<SentimentResult[]> {
  const { data, error } = await supabase
    .from("sentiment_results")
    .select("*")
    .eq("account_id", accountId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get sentiment counts for dashboard summary
export async function getSentimentSummary(): Promise<{
  red: number;
  yellow: number;
  green: number;
  unanalyzed: number;
}> {
  // Get all active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_active", true);

  if (accountsError) throw accountsError;

  if (!accounts || accounts.length === 0) {
    return { red: 0, yellow: 0, green: 0, unanalyzed: 0 };
  }

  const accountIds = accounts.map((a) => a.id);

  // Get latest sentiment for each account
  const { data: sentiments, error: sentimentsError } = await supabase
    .from("sentiment_results")
    .select("account_id, sentiment, analyzed_at")
    .in("account_id", accountIds)
    .order("analyzed_at", { ascending: false });

  if (sentimentsError) throw sentimentsError;

  // Get latest sentiment per account
  const latestByAccount = new Map<string, string>();
  for (const s of sentiments || []) {
    if (!latestByAccount.has(s.account_id)) {
      latestByAccount.set(s.account_id, s.sentiment);
    }
  }

  // Count
  let red = 0, yellow = 0, green = 0;
  for (const sentiment of latestByAccount.values()) {
    if (sentiment === "red") red++;
    else if (sentiment === "yellow") yellow++;
    else if (sentiment === "green") green++;
  }

  const unanalyzed = accounts.length - latestByAccount.size;

  return { red, yellow, green, unanalyzed };
}
