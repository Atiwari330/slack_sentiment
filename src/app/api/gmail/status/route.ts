import { NextResponse } from "next/server";
import { getGmailTokens } from "@/lib/gmail";

// GET /api/gmail/status - Check Gmail connection status
export async function GET() {
  try {
    const tokens = await getGmailTokens();

    if (!tokens) {
      return NextResponse.json({
        connected: false,
        email: null,
      });
    }

    return NextResponse.json({
      connected: true,
      email: tokens.email,
    });
  } catch (error) {
    console.error("Error checking Gmail status:", error);
    return NextResponse.json({
      connected: false,
      email: null,
    });
  }
}
