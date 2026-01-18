import { NextRequest, NextResponse } from "next/server";
import { updateDraftStatus, getDraftById } from "@/lib/db/email-drafts";

// POST /api/voice/drafts/[id]/approve - Approve a draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const draft = await getDraftById(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (draft.status !== "draft") {
      return NextResponse.json(
        { error: `Cannot approve draft with status: ${draft.status}` },
        { status: 400 }
      );
    }

    const updatedDraft = await updateDraftStatus(id, "approved");

    return NextResponse.json({
      draft: {
        id: updatedDraft.id,
        status: updatedDraft.status,
      },
    });
  } catch (error) {
    console.error("Error approving draft:", error);
    return NextResponse.json(
      { error: "Failed to approve draft" },
      { status: 500 }
    );
  }
}
