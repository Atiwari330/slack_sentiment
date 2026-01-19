import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAccountsWithSentiment } from "@/lib/db/accounts";
import { createAccountAction } from "@/lib/db/account-actions";
import {
  briefingGeneratorTools,
  BRIEFING_GENERATOR_SYSTEM_PROMPT,
} from "@/lib/agents/briefing-generator";

export const maxDuration = 120;

// Urgency filter: medium, high, critical (not low)
const URGENCY_TO_INCLUDE = ["medium", "high", "critical"];

// GET /api/briefing/generate - Generate briefing suggestions for at-risk accounts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // Get all accounts with sentiment
    const allAccounts = await getAccountsWithSentiment();

    // Filter to at-risk accounts (RED or YELLOW sentiment, or medium+ urgency)
    const atRiskAccounts = allAccounts.filter((account) => {
      // Include if sentiment is red or yellow
      if (account.latest_sentiment === "red" || account.latest_sentiment === "yellow") {
        return true;
      }
      // Also include if urgency is medium or higher
      if (account.urgency && URGENCY_TO_INCLUDE.includes(account.urgency)) {
        return true;
      }
      return false;
    });

    // Take top N accounts (they're already sorted by sentiment urgency)
    const accountsToProcess = atRiskAccounts.slice(0, limit);

    if (accountsToProcess.length === 0) {
      return NextResponse.json({
        briefing: [],
        message: "No at-risk accounts found. All accounts appear healthy!",
      });
    }

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

    // Generate suggestions for each account
    const briefingItems = [];

    for (const account of accountsToProcess) {
      try {
        console.log(`=== Generating briefing for ${account.name} ===`);

        const prompt = `Generate a briefing suggestion for this customer account:

Account Name: ${account.name}
Slack Channel ID: ${account.slack_channel_id}
Slack Channel Name: ${account.slack_channel_name || "Unknown"}
Account ID (for past actions): ${account.id}
Current Sentiment: ${account.latest_sentiment || "Unknown"}
Current Urgency: ${account.urgency || "Unknown"}
Latest Summary: ${account.latest_summary || "No summary available"}

${account.conversation_state ? `Conversation State: ${account.conversation_state.description}
Customer Waiting Hours: ${account.conversation_state.customerWaitingHours || "N/A"}
Last Vendor Response Hours: ${account.conversation_state.lastVendorResponseHours || "N/A"}` : ""}

${account.risk_factors && account.risk_factors.length > 0 ? `Risk Factors: ${account.risk_factors.join(", ")}` : ""}

Please:
1. Use fetch_recent_messages with channelId "${account.slack_channel_id}" to get context
2. Use get_past_actions with accountId "${account.id}" to check what's been done
3. Call generate_suggestion with your recommendation

IMPORTANT: You MUST call generate_suggestion at the end.`;

        const result = await generateText({
          model,
          system: BRIEFING_GENERATOR_SYSTEM_PROMPT,
          prompt,
          tools: briefingGeneratorTools,
          stopWhen: [hasToolCall("generate_suggestion"), stepCountIs(8)],
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
          console.log(`No suggestion generated for ${account.name}`);
          continue;
        }

        // Create an account action record in suggested state
        const action = await createAccountAction({
          account_id: account.id,
          action_type: "slack_message",
          trigger_source: "briefing",
          suggested_action: suggestion.suggestedSlackMessage,
          issue_summary: suggestion.issueSummary,
          slack_channel_id: account.slack_channel_id,
          sentiment_at_action: account.latest_sentiment || undefined,
          urgency_at_action: account.urgency || undefined,
        });

        briefingItems.push({
          actionId: action.id,
          account: {
            id: account.id,
            name: account.name,
            slackChannelId: account.slack_channel_id,
            slackChannelName: account.slack_channel_name,
          },
          sentiment: account.latest_sentiment,
          urgency: account.urgency,
          issueSummary: suggestion.issueSummary,
          suggestedMessage: suggestion.suggestedSlackMessage,
          reasoning: suggestion.reasoning,
          conversationState: account.conversation_state,
          riskFactors: account.risk_factors,
        });
      } catch (accountError) {
        console.error(`Error generating briefing for ${account.name}:`, accountError);
        // Continue with other accounts
      }
    }

    return NextResponse.json({
      briefing: briefingItems,
      totalAtRisk: atRiskAccounts.length,
      processed: briefingItems.length,
    });
  } catch (error) {
    console.error("Error generating briefing:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
