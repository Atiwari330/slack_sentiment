import { NextRequest, NextResponse } from "next/server";
import { getAccountActionById, markActionSkipped } from "@/lib/db/account-actions";

// POST /api/briefing/action/skip - Skip an action with optional reason
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actionId, reason } = body;

    if (!actionId) {
      return NextResponse.json(
        { error: "actionId is required" },
        { status: 400 }
      );
    }

    // Get the action record
    const action = await getAccountActionById(actionId);
    if (!action) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    if (action.status !== "suggested") {
      return NextResponse.json(
        { error: `Action already ${action.status}` },
        { status: 400 }
      );
    }

    console.log("=== Skipping Briefing Action ===");
    console.log("Action ID:", actionId);
    console.log("Reason:", reason || "No reason provided");

    // Mark the action as skipped
    const updatedAction = await markActionSkipped(actionId, reason);

    return NextResponse.json({
      success: true,
      action: {
        id: updatedAction.id,
        status: updatedAction.status,
        skipReason: updatedAction.skip_reason,
        executedAt: updatedAction.executed_at,
      },
    });
  } catch (error) {
    console.error("Error skipping action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to skip action" },
      { status: 500 }
    );
  }
}
