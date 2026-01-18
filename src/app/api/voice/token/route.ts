import { NextResponse } from "next/server";
import { createTemporaryApiKey, getDeepgramWebSocketUrl } from "@/lib/deepgram";

// GET /api/voice/token - Get temporary Deepgram credentials
export async function GET() {
  try {
    const { key, expiresAt } = await createTemporaryApiKey();

    return NextResponse.json({
      apiKey: key,
      wsUrl: getDeepgramWebSocketUrl(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating Deepgram token:", error);
    return NextResponse.json(
      { error: "Failed to create voice token. Please check DEEPGRAM_API_KEY configuration." },
      { status: 500 }
    );
  }
}
