import { NextRequest, NextResponse } from "next/server";
import { getActionsForAccount } from "@/lib/db/account-actions";

// GET /api/briefing/actions/[accountId] - Get action history for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    const actions = await getActionsForAccount(accountId, 20);

    return NextResponse.json({
      actions,
      count: actions.length,
    });
  } catch (error) {
    console.error("Error fetching account actions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch actions" },
      { status: 500 }
    );
  }
}
