import { NextRequest, NextResponse } from "next/server";
import { postMessage } from "@/lib/slack";
import { getBrainDumpRunById, markSlackSent } from "@/lib/db/brain-dump-runs";

// POST /api/brain-dump/send-slack - Send the Slack message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json(
        { error: "runId is required" },
        { status: 400 }
      );
    }

    // Get the run
    const run = await getBrainDumpRunById(runId);
    if (!run) {
      return NextResponse.json(
        { error: "Brain dump run not found" },
        { status: 404 }
      );
    }

    if (!run.draft_slack?.message) {
      return NextResponse.json(
        { error: "No Slack draft found" },
        { status: 400 }
      );
    }

    // Check if already sent
    if (run.slack_message_ts) {
      return NextResponse.json(
        { error: "Slack message already sent" },
        { status: 400 }
      );
    }

    console.log("=== Sending Slack Message ===");
    console.log("Channel:", run.slack_channel_name);
    console.log("Message:", run.draft_slack.message);

    // Post to Slack
    const messageTs = await postMessage(run.slack_channel_id, run.draft_slack.message);

    // Mark as sent
    const updatedRun = await markSlackSent(runId, messageTs);

    return NextResponse.json({
      success: true,
      messageTs,
      channelId: run.slack_channel_id,
      channelName: run.slack_channel_name,
      status: updatedRun.status,
    });
  } catch (error) {
    console.error("Error sending Slack message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send Slack message" },
      { status: 500 }
    );
  }
}
