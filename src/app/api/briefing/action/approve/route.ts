import { NextRequest, NextResponse } from "next/server";
import { postMessage } from "@/lib/slack";
import { getAccountActionById, markActionExecuted } from "@/lib/db/account-actions";

// POST /api/briefing/action/approve - Execute an approved action (send Slack message)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actionId, message } = body;

    if (!actionId) {
      return NextResponse.json(
        { error: "actionId is required" },
        { status: 400 }
      );
    }

    // Get the action record
    const action = await getAccountActionById(actionId);
    if (!action) {
      return NextResponse.json(
        { error: "Action not found" },
        { status: 404 }
      );
    }

    if (action.status !== "suggested") {
      return NextResponse.json(
        { error: `Action already ${action.status}` },
        { status: 400 }
      );
    }

    if (action.action_type !== "slack_message") {
      return NextResponse.json(
        { error: "Only slack_message actions can be approved via this endpoint" },
        { status: 400 }
      );
    }

    if (!action.slack_channel_id) {
      return NextResponse.json(
        { error: "No Slack channel ID associated with this action" },
        { status: 400 }
      );
    }

    // Use the provided message or fall back to the suggested action
    const messageToSend = message || action.suggested_action;
    if (!messageToSend) {
      return NextResponse.json(
        { error: "No message to send" },
        { status: 400 }
      );
    }

    console.log("=== Approving Briefing Action ===");
    console.log("Action ID:", actionId);
    console.log("Channel ID:", action.slack_channel_id);
    console.log("Message:", messageToSend);

    // Post the message to Slack
    const messageTs = await postMessage(action.slack_channel_id, messageToSend);

    // Mark the action as executed
    const updatedAction = await markActionExecuted(actionId, messageToSend, messageTs);

    return NextResponse.json({
      success: true,
      action: {
        id: updatedAction.id,
        status: updatedAction.status,
        executedMessage: updatedAction.executed_message,
        slackMessageTs: updatedAction.slack_message_ts,
        executedAt: updatedAction.executed_at,
      },
      slack: {
        channelId: action.slack_channel_id,
        messageTs,
      },
    });
  } catch (error) {
    console.error("Error approving action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve action" },
      { status: 500 }
    );
  }
}
