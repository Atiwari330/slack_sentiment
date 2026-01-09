import { NextRequest, NextResponse } from "next/server";
import { analyzeAllAccounts } from "@/lib/sentiment/analyze";

export const maxDuration = 300; // Allow up to 5 minutes for batch analysis

// GET /api/cron/analyze - Triggered by Vercel Cron or external service
export async function GET(request: NextRequest) {
  // Verify the cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it in the Authorization header
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting scheduled sentiment analysis...");

    const { results, errors } = await analyzeAllAccounts(1);

    console.log(
      `[Cron] Analysis complete: ${results.length} succeeded, ${errors.length} failed`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analyzed: results.length,
      failed: errors.length,
      summary: {
        red: results.filter((r) => r.sentiment === "red").length,
        yellow: results.filter((r) => r.sentiment === "yellow").length,
        green: results.filter((r) => r.sentiment === "green").length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Cron] Analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
