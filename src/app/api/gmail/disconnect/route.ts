import { NextResponse } from "next/server";
import { deleteGmailTokens } from "@/lib/gmail";

// POST /api/gmail/disconnect - Disconnect Gmail
export async function POST() {
  try {
    await deleteGmailTokens();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}
