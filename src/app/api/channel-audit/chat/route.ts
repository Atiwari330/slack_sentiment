import { streamText, createGateway, UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";
import {
  channelAuditTools,
  CHANNEL_AUDIT_SYSTEM_PROMPT,
  CHANNEL_AUDIT_INITIAL_ANALYSIS_PROMPT,
} from "@/lib/agents/channel-audit-agent";

export const maxDuration = 60;

// Convert UI messages (with parts) to model messages (with content)
function convertToModelMessages(uiMessages: UIMessage[]) {
  return uiMessages.map((msg) => {
    // Extract text content from parts array
    const textContent =
      msg.parts
        ?.filter(
          (part): part is { type: "text"; text: string } => part.type === "text"
        )
        .map((part) => part.text)
        .join("") || "";

    return {
      role: msg.role as "user" | "assistant",
      content: textContent,
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages: uiMessages,
      channelId,
      channelName,
      asanaProjectId,
      isInitialAnalysis,
    } = body;

    // Validate required fields
    if (!uiMessages || !Array.isArray(uiMessages)) {
      return new Response("Messages array is required", { status: 400 });
    }

    if (!channelId) {
      return new Response("Channel ID is required", { status: 400 });
    }

    // Convert UI messages to model messages
    const messages = convertToModelMessages(uiMessages);

    // Check for API keys
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!gatewayKey && !openaiKey) {
      return new Response("AI API key is not configured", { status: 500 });
    }

    // Get the model from env or use default
    const modelId = process.env.AI_MODEL || "openai/gpt-4o";

    // Fetch channel context (5 days by default)
    let channelContext = "";
    try {
      const history = await getChannelHistory(channelId, 5);
      channelContext = formatMessagesForContext(history);
    } catch (error) {
      console.error("Error fetching channel context:", error);
      channelContext =
        "Unable to fetch channel history. The bot may need to be invited to this channel.";
    }

    // Build the system prompt with channel context
    const systemPrompt = `${CHANNEL_AUDIT_SYSTEM_PROMPT}

## Current Channel Context

Channel: #${channelName || "unknown"}
${asanaProjectId ? `Asana Project ID: ${asanaProjectId}` : "No Asana project selected"}

Here are the messages from the last 5 days:
---
${channelContext}
---

${isInitialAnalysis ? CHANNEL_AUDIT_INITIAL_ANALYSIS_PROMPT : ""}`;

    // Create the appropriate provider based on available API key
    let model;

    if (gatewayKey) {
      const gateway = createGateway({
        apiKey: gatewayKey,
      });
      model = gateway(modelId);
    } else {
      const openai = createOpenAI({
        apiKey: openaiKey,
      });
      model = openai(modelId);
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: channelAuditTools,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Channel audit chat API error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred";
    return new Response(message, { status: 500 });
  }
}
