import { supabase, InboxDraft } from "@/lib/supabase";

// Get all drafts for a session
export async function getInboxDraftsBySession(sessionId: string): Promise<InboxDraft[]> {
  const { data, error } = await supabase
    .from("inbox_drafts")
    .select("*")
    .eq("session_id", sessionId)
    .order("version", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get the latest draft for a session
export async function getLatestInboxDraft(sessionId: string): Promise<InboxDraft | null> {
  const { data, error } = await supabase
    .from("inbox_drafts")
    .select("*")
    .eq("session_id", sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Get a draft by ID
export async function getInboxDraftById(id: string): Promise<InboxDraft | null> {
  const { data, error } = await supabase
    .from("inbox_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Create a new inbox draft
export async function createInboxDraft(draft: {
  session_id: string;
  transcription: string;
  thread_id: string;
  original_message_id: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body: string;
  thread_context?: string;
}): Promise<InboxDraft> {
  // Get the next version number for this session
  const existingDrafts = await getInboxDraftsBySession(draft.session_id);
  const nextVersion = existingDrafts.length > 0 ? existingDrafts[0].version + 1 : 1;

  const { data, error } = await supabase
    .from("inbox_drafts")
    .insert({
      session_id: draft.session_id,
      version: nextVersion,
      status: "draft",
      transcription: draft.transcription,
      thread_id: draft.thread_id,
      original_message_id: draft.original_message_id,
      recipient_email: draft.recipient_email,
      recipient_name: draft.recipient_name || null,
      subject: draft.subject,
      body: draft.body,
      thread_context: draft.thread_context || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Create a revision (new version) of a draft
export async function createInboxRevision(
  sessionId: string,
  feedback: string,
  updates: {
    subject?: string;
    body?: string;
    recipient_email?: string;
    recipient_name?: string;
  }
): Promise<InboxDraft> {
  const latestDraft = await getLatestInboxDraft(sessionId);
  if (!latestDraft) {
    throw new Error("No draft found for this session");
  }

  const { data, error } = await supabase
    .from("inbox_drafts")
    .insert({
      session_id: sessionId,
      version: latestDraft.version + 1,
      status: "draft",
      transcription: latestDraft.transcription,
      thread_id: latestDraft.thread_id,
      original_message_id: latestDraft.original_message_id,
      recipient_email: updates.recipient_email || latestDraft.recipient_email,
      recipient_name: updates.recipient_name || latestDraft.recipient_name,
      subject: updates.subject || latestDraft.subject,
      body: updates.body || latestDraft.body,
      thread_context: latestDraft.thread_context,
      feedback: feedback,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update draft status
export async function updateInboxDraftStatus(
  id: string,
  status: "draft" | "approved" | "sent" | "cancelled",
  gmailMessageId?: string
): Promise<InboxDraft> {
  const updateData: Record<string, unknown> = { status };

  if (status === "sent") {
    updateData.sent_at = new Date().toISOString();
    if (gmailMessageId) {
      updateData.gmail_message_id = gmailMessageId;
    }
  }

  const { data, error } = await supabase
    .from("inbox_drafts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get recent inbox drafts (for history view)
export async function getRecentInboxDrafts(limit: number = 20): Promise<InboxDraft[]> {
  const { data, error } = await supabase
    .from("inbox_drafts")
    .select("*")
    .in("status", ["sent", "approved"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Delete all drafts for a session
export async function deleteInboxSessionDrafts(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("inbox_drafts")
    .delete()
    .eq("session_id", sessionId);

  if (error) throw error;
}
