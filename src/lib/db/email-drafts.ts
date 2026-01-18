import { supabase, EmailDraft } from "@/lib/supabase";

// Get all drafts for a session
export async function getDraftsBySession(sessionId: string): Promise<EmailDraft[]> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("session_id", sessionId)
    .order("version", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get the latest draft for a session
export async function getLatestDraft(sessionId: string): Promise<EmailDraft | null> {
  const { data, error } = await supabase
    .from("email_drafts")
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
export async function getDraftById(id: string): Promise<EmailDraft | null> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Create a new draft
export async function createDraft(draft: {
  session_id: string;
  transcription: string;
  contact_id?: string;
  recipient_email?: string;
  recipient_name?: string;
  subject?: string;
  body?: string;
}): Promise<EmailDraft> {
  // Get the next version number for this session
  const existingDrafts = await getDraftsBySession(draft.session_id);
  const nextVersion = existingDrafts.length > 0 ? existingDrafts[0].version + 1 : 1;

  const { data, error } = await supabase
    .from("email_drafts")
    .insert({
      session_id: draft.session_id,
      version: nextVersion,
      status: "draft",
      transcription: draft.transcription,
      contact_id: draft.contact_id || null,
      recipient_email: draft.recipient_email || null,
      recipient_name: draft.recipient_name || null,
      subject: draft.subject || null,
      body: draft.body || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Create a revision (new version) of a draft
export async function createRevision(
  sessionId: string,
  feedback: string,
  updates: {
    subject?: string;
    body?: string;
    recipient_email?: string;
    recipient_name?: string;
  }
): Promise<EmailDraft> {
  const latestDraft = await getLatestDraft(sessionId);
  if (!latestDraft) {
    throw new Error("No draft found for this session");
  }

  const { data, error } = await supabase
    .from("email_drafts")
    .insert({
      session_id: sessionId,
      version: latestDraft.version + 1,
      status: "draft",
      transcription: latestDraft.transcription,
      contact_id: latestDraft.contact_id,
      recipient_email: updates.recipient_email || latestDraft.recipient_email,
      recipient_name: updates.recipient_name || latestDraft.recipient_name,
      subject: updates.subject || latestDraft.subject,
      body: updates.body || latestDraft.body,
      feedback: feedback,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update draft status
export async function updateDraftStatus(
  id: string,
  status: "draft" | "approved" | "sent" | "cancelled",
  gmailMessageId?: string
): Promise<EmailDraft> {
  const updateData: Record<string, unknown> = { status };

  if (status === "sent") {
    updateData.sent_at = new Date().toISOString();
    if (gmailMessageId) {
      updateData.gmail_message_id = gmailMessageId;
    }
  }

  const { data, error } = await supabase
    .from("email_drafts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get recent drafts (for history view)
export async function getRecentDrafts(limit: number = 20): Promise<EmailDraft[]> {
  const { data, error } = await supabase
    .from("email_drafts")
    .select("*")
    .in("status", ["sent", "approved"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Delete all drafts for a session
export async function deleteSessionDrafts(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("email_drafts")
    .delete()
    .eq("session_id", sessionId);

  if (error) throw error;
}
