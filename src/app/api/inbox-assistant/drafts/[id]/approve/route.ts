import { NextRequest, NextResponse } from "next/server";
import { getInboxDraftById, updateInboxDraftStatus } from "@/lib/db/inbox-drafts";

// POST /api/inbox-assistant/drafts/[id]/approve - Mark a draft as approved
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the draft
    const draft = await getInboxDraftById(id);
    if (!draft) {
      return NextResponse.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    // Check current status
    if (draft.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot approve draft with status: ${draft.status}` },
        { status: 400 }
      );
    }

    // Update status to approved
    const updatedDraft = await updateInboxDraftStatus(id, "approved");

    return NextResponse.json({
      success: true,
      draft: {
        id: updatedDraft.id,
        sessionId: updatedDraft.session_id,
        version: updatedDraft.version,
        status: updatedDraft.status,
        threadId: updatedDraft.thread_id,
        originalMessageId: updatedDraft.original_message_id,
        recipientEmail: updatedDraft.recipient_email,
        recipientName: updatedDraft.recipient_name,
        subject: updatedDraft.subject,
        body: updatedDraft.body,
      },
    });
  } catch (error) {
    console.error("Error approving inbox draft:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve draft",
      },
      { status: 500 }
    );
  }
}
