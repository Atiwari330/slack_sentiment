import { streamText, createGateway, UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getChannelHistory, formatMessagesForContext } from "@/lib/slack";

export const maxDuration = 60;

// Convert UI messages (with parts) to model messages (with content)
function convertToModelMessages(uiMessages: UIMessage[]) {
  return uiMessages.map((msg) => {
    // Extract text content from parts array
    const textContent = msg.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
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
    console.log("=== Raw request body keys ===", Object.keys(body));
    console.log("=== channelId ===", body.channelId);
    console.log("=== channelName ===", body.channelName);

    const { messages: uiMessages, channelId, channelName } = body;

    // Validate required fields
    if (!uiMessages || !Array.isArray(uiMessages)) {
      return new Response("Messages array is required", { status: 400 });
    }

    // Convert UI messages to model messages
    const messages = convertToModelMessages(uiMessages);
    console.log("=== Converted messages ===");
    console.log(JSON.stringify(messages, null, 2));

    // Check for API keys
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!gatewayKey && !openaiKey) {
      return new Response("AI API key is not configured", { status: 500 });
    }

    // Get the model from env or use default
    const modelId = process.env.AI_MODEL || "openai/gpt-4o";

    // Fetch channel context if channelId is provided
    let channelContext = "";
    if (channelId) {
      try {
        const history = await getChannelHistory(channelId, 1);
        channelContext = formatMessagesForContext(history);
      } catch (error) {
        console.error("Error fetching channel context:", error);
        channelContext = "Unable to fetch channel history. The bot may need to be invited to this channel.";
      }
    }

    // Build the system prompt
    const systemPrompt = channelId
      ? `You are a helpful assistant that helps users understand and interact with their Slack channel conversations.

You have access to the message history from the Slack channel "${channelName || "selected channel"}" from the last day.

Here is the conversation history:
---
${channelContext}
---

Based on this context, help the user by:
- Summarizing discussions and key points
- Answering questions about what was discussed
- Identifying action items or decisions made
- Finding specific information mentioned in conversations
- Providing insights about team communication patterns

Be concise but thorough. If the user asks about something not in the provided history, let them know it may have occurred outside the 1-day window or in a different channel.`
      : `You are a helpful assistant. Please select a Slack channel to start analyzing conversations.`;

    // Create the appropriate provider based on available API key
    let model;

    if (gatewayKey) {
      // Use Vercel AI Gateway (modern approach)
      const gateway = createGateway({
        apiKey: gatewayKey,
      });
      model = gateway(modelId);
      console.log("Using AI Gateway with model:", modelId);
    } else {
      // Fall back to direct OpenAI
      const openai = createOpenAI({
        apiKey: openaiKey,
      });
      model = openai(modelId);
      console.log("Using direct OpenAI with model:", modelId);
    }

    console.log("=== Starting streamText ===");
    console.log("System prompt length:", systemPrompt.length);
    console.log("Messages count:", messages.length);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
    });

    console.log("=== Stream created, returning response ===");

    const response = result.toUIMessageStreamResponse();
    console.log("Response type:", response.constructor.name);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return new Response(message, { status: 500 });
  }
}
