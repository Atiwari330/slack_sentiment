import { streamText, createGateway, UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAccountById } from "@/lib/db/accounts";
import { investigatorTools, INVESTIGATOR_SYSTEM_PROMPT } from "@/lib/agents/investigator";

export const maxDuration = 60;

// Convert UI messages to model messages
function convertToModelMessages(uiMessages: UIMessage[]) {
  return uiMessages.map((msg) => {
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const body = await req.json();
    const { messages: uiMessages } = body;

    // Validate account exists
    const account = await getAccountById(accountId);
    if (!account) {
      return new Response("Account not found", { status: 404 });
    }

    // Validate messages
    if (!uiMessages || !Array.isArray(uiMessages)) {
      return new Response("Messages array is required", { status: 400 });
    }

    // Convert UI messages to model messages
    const messages = convertToModelMessages(uiMessages);

    // Check for API keys
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!gatewayKey && !openaiKey) {
      return new Response("AI API key is not configured", { status: 500 });
    }

    // Get the model from env
    const modelId = process.env.AI_MODEL || "openai/gpt-4o";

    // Create the model
    let model;
    if (gatewayKey) {
      const gateway = createGateway({ apiKey: gatewayKey });
      model = gateway(modelId);
    } else {
      const openai = createOpenAI({ apiKey: openaiKey });
      model = openai(modelId);
    }

    // Build context-aware system prompt
    const systemPrompt = `${INVESTIGATOR_SYSTEM_PROMPT}

## Current Account Context
- Account Name: ${account.name}
- Slack Channel: #${account.slack_channel_name || account.slack_channel_id}
- Channel ID: ${account.slack_channel_id}
- Account ID: ${account.id}

When using tools, use these IDs:
- For fetch_messages and search_messages: channelId = "${account.slack_channel_id}"
- For get_sentiment_history: accountId = "${account.id}"`;

    // Stream the response with tools
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: investigatorTools,
      maxSteps: 5, // Allow up to 5 tool calls per request
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Investigate API error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return new Response(message, { status: 500 });
  }
}
