import { supabase, AccountAction } from "@/lib/supabase";

// Create a new account action (suggested state)
export async function createAccountAction(action: {
  account_id: string;
  action_type: AccountAction["action_type"];
  trigger_source: AccountAction["trigger_source"];
  suggested_action?: string;
  issue_summary?: string;
  slack_channel_id?: string;
  sentiment_at_action?: string;
  urgency_at_action?: string;
}): Promise<AccountAction> {
  const { data, error } = await supabase
    .from("account_actions")
    .insert({
      account_id: action.account_id,
      action_type: action.action_type,
      trigger_source: action.trigger_source,
      suggested_action: action.suggested_action || null,
      issue_summary: action.issue_summary || null,
      slack_channel_id: action.slack_channel_id || null,
      sentiment_at_action: action.sentiment_at_action || null,
      urgency_at_action: action.urgency_at_action || null,
      status: "suggested",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get an account action by ID
export async function getAccountActionById(id: string): Promise<AccountAction | null> {
  const { data, error } = await supabase
    .from("account_actions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Mark action as executed (approved and sent)
export async function markActionExecuted(
  id: string,
  executedMessage: string,
  slackMessageTs?: string
): Promise<AccountAction> {
  const { data, error } = await supabase
    .from("account_actions")
    .update({
      status: "executed",
      executed_message: executedMessage,
      slack_message_ts: slackMessageTs || null,
      executed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Mark action as skipped
export async function markActionSkipped(
  id: string,
  skipReason?: string
): Promise<AccountAction> {
  const { data, error } = await supabase
    .from("account_actions")
    .update({
      status: "skipped",
      skip_reason: skipReason || null,
      executed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update the suggested action (for revisions)
export async function updateSuggestedAction(
  id: string,
  suggestedAction: string
): Promise<AccountAction> {
  const { data, error } = await supabase
    .from("account_actions")
    .update({
      suggested_action: suggestedAction,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get actions for an account (for action history)
export async function getActionsForAccount(
  accountId: string,
  limit: number = 20
): Promise<AccountAction[]> {
  const { data, error } = await supabase
    .from("account_actions")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Get recent actions across all accounts (for briefing summary)
export async function getRecentActions(limit: number = 50): Promise<AccountAction[]> {
  const { data, error } = await supabase
    .from("account_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Delete an account action
export async function deleteAccountAction(id: string): Promise<void> {
  const { error } = await supabase
    .from("account_actions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
