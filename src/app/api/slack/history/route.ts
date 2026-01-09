import { NextRequest, NextResponse } from "next/server";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      return NextResponse.json(
        { error: "SLACK_BOT_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const daysBack = parseInt(searchParams.get("days") ?? "10", 10);

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    const messages = await getChannelHistory(channelId, daysBack);
    const formattedContext = formatMessagesForContext(messages);

    return NextResponse.json({
      messageCount: messages.length,
      daysBack,
      context: formattedContext,
      messages: messages.slice(-50), // Return last 50 messages for display
    });
  } catch (error) {
    console.error("Error fetching channel history:", error);

    const message = error instanceof Error ? error.message : "Failed to fetch history";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
