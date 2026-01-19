import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAccountActionById, updateSuggestedAction } from "@/lib/db/account-actions";
import {
  briefingGeneratorTools,
  BRIEFING_REVISER_SYSTEM_PROMPT,
} from "@/lib/agents/briefing-generator";

export const maxDuration = 60;

// POST /api/briefing/action/revise - Regenerate suggestion with feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actionId, feedback } = body;

    if (!actionId) {
      return NextResponse.json(
        { error: "actionId is required" },
        { status: 400 }
      );
    }

    if (!feedback || typeof feedback !== "string") {
      return NextResponse.json(
        { error: "feedback is required" },
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
        { error: `Cannot revise action that is ${action.status}` },
        { status: 400 }
      );
    }

    console.log("=== Revising Briefing Action ===");
    console.log("Action ID:", actionId);
    console.log("Feedback:", feedback);
    console.log("Current suggestion:", action.suggested_action);

    // Get AI provider configuration
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const modelId = process.env.AI_MODEL || "openai/gpt-4o";

    if (!gatewayKey && !openaiKey) {
      return NextResponse.json(
        { error: "AI provider not configured" },
        { status: 500 }
      );
    }

    // Create the model
    let model;
    if (gatewayKey) {
      const gateway = createGateway({ apiKey: gatewayKey });
      model = gateway(modelId);
    } else {
      const openai = createOpenAI({ apiKey: openaiKey });
      model = openai(modelId);
    }

    const prompt = `Revise this Slack message based on user feedback.

Current Issue Summary: ${action.issue_summary || "Not available"}

Current Suggested Message:
${action.suggested_action || "No current suggestion"}

User Feedback:
${feedback}

Please generate a revised suggestion that addresses the feedback. Call generate_suggestion with the updated message.

IMPORTANT: You MUST call generate_suggestion at the end.`;

    const result = await generateText({
      model,
      system: BRIEFING_REVISER_SYSTEM_PROMPT,
      prompt,
      tools: briefingGeneratorTools,
      stopWhen: [hasToolCall("generate_suggestion"), stepCountIs(5)],
    });

    // Find the generate_suggestion tool result
    let suggestion = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as {
          success?: boolean;
          suggestion?: {
            issueSummary: string;
            suggestedSlackMessage: string;
            reasoning: string;
          };
        } | undefined;
        if (toolResult.toolName === "generate_suggestion" && output?.success) {
          suggestion = output.suggestion;
        }
      }
    }

    if (!suggestion) {
      return NextResponse.json(
        { error: "Failed to generate revised suggestion" },
        { status: 500 }
      );
    }

    // Update the action with the new suggestion
    const updatedAction = await updateSuggestedAction(actionId, suggestion.suggestedSlackMessage);

    return NextResponse.json({
      success: true,
      action: {
        id: updatedAction.id,
        status: updatedAction.status,
        suggestedAction: updatedAction.suggested_action,
        issueSummary: action.issue_summary, // Keep original issue summary
      },
      revised: {
        suggestedMessage: suggestion.suggestedSlackMessage,
        reasoning: suggestion.reasoning,
      },
    });
  } catch (error) {
    console.error("Error revising action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise action" },
      { status: 500 }
    );
  }
}
