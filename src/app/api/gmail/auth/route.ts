import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/gmail";

// GET /api/gmail/auth - Start Gmail OAuth flow
export async function GET() {
  try {
    const authUrl = getOAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error starting Gmail OAuth:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start OAuth" },
      { status: 500 }
    );
  }
}
