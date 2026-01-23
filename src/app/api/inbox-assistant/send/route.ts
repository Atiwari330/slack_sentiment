import { NextRequest, NextResponse } from "next/server";
import { getInboxDraftById, updateInboxDraftStatus } from "@/lib/db/inbox-drafts";
import { getMessage, sendReply } from "@/lib/gmail";

// POST /api/inbox-assistant/send - Send an approved reply via Gmail
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: "draftId is required" },
        { status: 400 }
      );
    }

    // Get the draft
    const draft = await getInboxDraftById(draftId);
    if (!draft) {
      return NextResponse.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    // Check draft status
    if (draft.status !== "approved") {
      return NextResponse.json(
        { error: "Draft must be approved before sending" },
        { status: 400 }
      );
    }

    // Get the original message for proper threading
    const originalMessage = await getMessage(draft.original_message_id);

    // Send the reply using Gmail API with proper threading
    const { messageId } = await sendReply(originalMessage, draft.body);

    // Update draft status to sent
    const updatedDraft = await updateInboxDraftStatus(
      draftId,
      "sent",
      messageId
    );

    return NextResponse.json({
      success: true,
      messageId,
      draft: {
        id: updatedDraft.id,
        status: updatedDraft.status,
        sentAt: updatedDraft.sent_at,
        gmailMessageId: updatedDraft.gmail_message_id,
      },
    });
  } catch (error) {
    console.error("Error sending inbox reply:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to send reply";

    if (errorMessage.includes("Gmail not connected")) {
      return NextResponse.json(
        { error: "Please connect your Gmail account", code: "GMAIL_NOT_CONNECTED" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: errorMessage, code: "SEND_FAILED" },
      { status: 500 }
    );
  }
}
