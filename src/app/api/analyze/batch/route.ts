import { NextRequest, NextResponse } from "next/server";
import { analyzeAllAccounts } from "@/lib/sentiment/analyze";

export const maxDuration = 300; // Allow up to 5 minutes for batch analysis

// POST /api/analyze/batch - Analyze all accounts
export async function POST(request: NextRequest) {
  try {
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

    const { results, errors } = await analyzeAllAccounts(daysBack);

    return NextResponse.json({
      success: true,
      analyzed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error("Error in batch analysis:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run batch analysis" },
      { status: 500 }
    );
  }
}
