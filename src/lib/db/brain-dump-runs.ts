import { supabase, BrainDumpRun, BrainDumpSlackDraft, BrainDumpAsanaDraft } from "@/lib/supabase";

// Get a brain dump run by ID
export async function getBrainDumpRunById(id: string): Promise<BrainDumpRun | null> {
  const { data, error } = await supabase
    .from("brain_dump_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Create a new brain dump run
export async function createBrainDumpRun(run: {
  input_transcript: string;
  slack_channel_id: string;
  slack_channel_name: string;
  slack_user_id?: string;
  contact_id?: string;
  contact_name: string;
  contact_email: string;
  asana_project_id?: string;
  asana_project_name?: string;
  draft_slack?: BrainDumpSlackDraft;
  draft_asana?: BrainDumpAsanaDraft;
}): Promise<BrainDumpRun> {
  const { data, error } = await supabase
    .from("brain_dump_runs")
    .insert({
      input_transcript: run.input_transcript,
      slack_channel_id: run.slack_channel_id,
      slack_channel_name: run.slack_channel_name,
      slack_user_id: run.slack_user_id || null,
      contact_id: run.contact_id || null,
      contact_name: run.contact_name,
      contact_email: run.contact_email,
      asana_project_id: run.asana_project_id || null,
      asana_project_name: run.asana_project_name || null,
      draft_slack: run.draft_slack || null,
      draft_asana: run.draft_asana || null,
      revision_history: [],
      status: "draft",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update drafts for a brain dump run
export async function updateBrainDumpDrafts(
  id: string,
  drafts: {
    draft_slack?: BrainDumpSlackDraft;
    draft_asana?: BrainDumpAsanaDraft;
  }
): Promise<BrainDumpRun> {
  const { data, error } = await supabase
    .from("brain_dump_runs")
    .update(drafts)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Add revision feedback to history
export async function addRevisionFeedback(
  id: string,
  feedback: string
): Promise<BrainDumpRun> {
  const run = await getBrainDumpRunById(id);
  if (!run) {
    throw new Error("Brain dump run not found");
  }

  const newHistory = [
    ...(run.revision_history || []),
    { feedback, timestamp: new Date().toISOString() },
  ];

  const { data, error } = await supabase
    .from("brain_dump_runs")
    .update({ revision_history: newHistory })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Mark Slack message as sent
export async function markSlackSent(
  id: string,
  messageTs: string
): Promise<BrainDumpRun> {
  const run = await getBrainDumpRunById(id);
  if (!run) {
    throw new Error("Brain dump run not found");
  }

  const newStatus = run.status === "asana_created" ? "complete" : "slack_sent";

  const { data, error } = await supabase
    .from("brain_dump_runs")
    .update({
      status: newStatus,
      final_slack_sent_at: new Date().toISOString(),
      slack_message_ts: messageTs,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Mark Asana task as created
export async function markAsanaCreated(
  id: string,
  taskGid: string,
  taskUrl: string
): Promise<BrainDumpRun> {
  const run = await getBrainDumpRunById(id);
  if (!run) {
    throw new Error("Brain dump run not found");
  }

  const newStatus = run.status === "slack_sent" ? "complete" : "asana_created";

  const { data, error } = await supabase
    .from("brain_dump_runs")
    .update({
      status: newStatus,
      final_asana_created_at: new Date().toISOString(),
      asana_task_gid: taskGid,
      asana_task_url: taskUrl,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get recent brain dump runs (for history view)
export async function getRecentBrainDumpRuns(limit: number = 20): Promise<BrainDumpRun[]> {
  const { data, error } = await supabase
    .from("brain_dump_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Delete a brain dump run
export async function deleteBrainDumpRun(id: string): Promise<void> {
  const { error } = await supabase
    .from("brain_dump_runs")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
