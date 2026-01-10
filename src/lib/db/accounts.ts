import { supabase, Account, AccountWithSentiment } from "@/lib/supabase";

// Get all accounts with their latest sentiment
export async function getAccountsWithSentiment(): Promise<AccountWithSentiment[]> {
  // First get all active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
    throw accountsError;
  }

  if (!accounts || accounts.length === 0) {
    return [];
  }

  // Get latest sentiment for each account
  const accountIds = accounts.map((a) => a.id);
  const { data: sentiments, error: sentimentsError } = await supabase
    .from("sentiment_results")
    .select("*")
    .in("account_id", accountIds)
    .order("analyzed_at", { ascending: false });

  if (sentimentsError) {
    console.error("Error fetching sentiments:", sentimentsError);
    throw sentimentsError;
  }

  // Map to get latest sentiment per account
  const latestSentimentByAccount = new Map<string, typeof sentiments[0]>();
  for (const sentiment of sentiments || []) {
    if (!latestSentimentByAccount.has(sentiment.account_id)) {
      latestSentimentByAccount.set(sentiment.account_id, sentiment);
    }
  }

  // Combine accounts with their latest sentiment
  const accountsWithSentiment: AccountWithSentiment[] = accounts.map((account) => {
    const sentiment = latestSentimentByAccount.get(account.id);
    return {
      ...account,
      latest_sentiment: sentiment?.sentiment || null,
      latest_summary: sentiment?.summary || null,
      last_analyzed: sentiment?.analyzed_at || null,
      confidence: sentiment?.confidence || null,
      risk_factors: sentiment?.risk_factors || null,
      timeline: sentiment?.timeline || null,
      conversation_state: sentiment?.conversation_state || null,
      urgency: sentiment?.urgency || null,
    };
  });

  // Sort by sentiment (red first, then yellow, then green, then unanalyzed)
  const sentimentOrder = { red: 0, yellow: 1, green: 2, null: 3 };
  accountsWithSentiment.sort((a, b) => {
    const orderA = sentimentOrder[a.latest_sentiment ?? "null"];
    const orderB = sentimentOrder[b.latest_sentiment ?? "null"];
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return accountsWithSentiment;
}

// Get a single account by ID
export async function getAccountById(id: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Create a new account
export async function createAccount(
  name: string,
  slackChannelId: string,
  slackChannelName?: string
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name,
      slack_channel_id: slackChannelId,
      slack_channel_name: slackChannelName || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update an account
export async function updateAccount(
  id: string,
  updates: Partial<Pick<Account, "name" | "slack_channel_id" | "slack_channel_name" | "is_active">>
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete (soft delete) an account
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// Get all accounts (for listing)
export async function getAllAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}
