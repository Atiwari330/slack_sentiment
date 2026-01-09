import { NextResponse } from "next/server";
import { getChannels } from "@/lib/slack";

export async function GET() {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      return NextResponse.json(
        { error: "SLACK_BOT_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const channels = await getChannels();
    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Error fetching channels:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch channels";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
