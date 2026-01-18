import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { getDraftById, updateDraftStatus } from "@/lib/db/email-drafts";

// POST /api/gmail/send - Send an approved email draft
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
    const draft = await getDraftById(draftId);
    if (!draft) {
      return NextResponse.json(
        { error: "Draft not found" },
        { status: 404 }
      );
    }

    if (draft.status !== "approved") {
      return NextResponse.json(
        { error: "Draft must be approved before sending" },
        { status: 400 }
      );
    }

    if (!draft.recipient_email || !draft.subject || !draft.body) {
      return NextResponse.json(
        { error: "Draft is missing required fields" },
        { status: 400 }
      );
    }

    // Send the email
    const { messageId } = await sendEmail(
      draft.recipient_email,
      draft.subject,
      draft.body
    );

    // Update draft status to sent
    await updateDraftStatus(draftId, "sent", messageId);

    return NextResponse.json({
      success: true,
      messageId,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
