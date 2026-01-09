import { NextRequest, NextResponse } from "next/server";
import { analyzeAccount } from "@/lib/sentiment/analyze";

export const maxDuration = 60; // Allow up to 60 seconds for analysis

// POST /api/analyze/[accountId] - Analyze a single account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Get optional daysBack from request body
    let daysBack = 1;
    try {
      const body = await request.json();
      if (body.daysBack && typeof body.daysBack === "number") {
        daysBack = Math.min(Math.max(body.daysBack, 1), 30); // Clamp between 1 and 30
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    const result = await analyzeAccount(accountId, daysBack);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error analyzing account:", error);

    if (error instanceof Error && error.message === "Account not found") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze account" },
      { status: 500 }
    );
  }
}
