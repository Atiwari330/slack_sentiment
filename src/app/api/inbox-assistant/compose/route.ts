import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  inboxAssistantTools,
  buildInboxAssistantPrompt,
} from "@/lib/agents/inbox-assistant";
import { createInboxDraft } from "@/lib/db/inbox-drafts";
import { hasReadScope } from "@/lib/gmail";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

// Response types
interface ClarificationResponse {
  type: "clarification";
  question: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  context?: string;
  sessionId: string;
}

interface DraftResponse {
  type: "draft";
  draft: {
    id: string;
    sessionId: string;
    version: number;
    status: string;
    threadId: string;
    originalMessageId: string;
    recipientEmail: string;
    recipientName: string | null;
    subject: string;
    body: string;
    threadContext: string | null;
  };
}

interface MessageResponse {
  type: "message";
  message: string;
  sessionId: string;
}

interface ErrorResponse {
  type: "error";
  error: string;
  code?: string;
}

type ComposeResponse =
  | ClarificationResponse
  | DraftResponse
  | MessageResponse
  | ErrorResponse;

// POST /api/inbox-assistant/compose - Main agent endpoint for searching, reading, and drafting replies
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, sessionId: existingSessionId, clarificationChoice } = body;

    if (!transcription) {
      return NextResponse.json(
        { type: "error", error: "transcription is required", code: "MISSING_TRANSCRIPTION" },
        { status: 400 }
      );
    }

    // Check Gmail read scope
    const canReadGmail = await hasReadScope();
    if (!canReadGmail) {
      return NextResponse.json(
        {
          type: "error",
          error: "Please reconnect Gmail to grant inbox read access",
          code: "SCOPE_INSUFFICIENT",
        },
        { status: 403 }
      );
    }

    console.log("=== Inbox Assistant Compose Debug ===");
    console.log("Transcription:", transcription);
    console.log("Existing Session:", existingSessionId);
    console.log("Clarification Choice:", clarificationChoice);

    // Get AI provider configuration
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const modelId = process.env.AI_MODEL || "openai/gpt-4o";

    if (!gatewayKey && !openaiKey) {
      return NextResponse.json(
        { type: "error", error: "AI provider not configured", code: "AI_NOT_CONFIGURED" },
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

    // Build dynamic system prompt with user context
    const systemPrompt = await buildInboxAssistantPrompt();

    // Build the user prompt
    let userPrompt = `The user has this request:\n\n"${transcription}"`;

    if (clarificationChoice) {
      userPrompt += `\n\nThe user selected option: ${clarificationChoice.id} - ${clarificationChoice.label}`;
      userPrompt += `\n\nNow proceed with reading the thread and drafting a reply for this specific email.`;
    } else {
      userPrompt += `\n\nFollow these steps:
1. Search the inbox based on the request
2. If multiple emails match, use ask_clarification to let the user choose
3. If one email matches, use get_thread to read the full conversation
4. Use create_reply_draft to compose the response

You MUST call either ask_clarification (if multiple matches) or create_reply_draft (if ready to draft).`;
    }

    // Generate using the agent
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      tools: inboxAssistantTools,
      stopWhen: [
        hasToolCall("ask_clarification"),
        hasToolCall("create_reply_draft"),
        stepCountIs(15),
      ],
    });

    // Log AI execution results
    console.log("AI Steps:", result.steps.length);
    for (const step of result.steps) {
      console.log(
        "Step tool calls:",
        step.toolCalls?.map((tc) => tc.toolName)
      );
    }

    // Session ID - use existing or create new
    const sessionId = existingSessionId || uuidv4();

    // Process tool results to determine response type
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as Record<string, unknown> | undefined;

        // Check for clarification request
        if (
          toolResult.toolName === "ask_clarification" &&
          output?.needsClarification
        ) {
          const response: ClarificationResponse = {
            type: "clarification",
            question: output.question as string,
            options: output.options as Array<{
              id: string;
              label: string;
              description?: string;
            }>,
            context: output.context as string | undefined,
            sessionId,
          };
          return NextResponse.json(response);
        }

        // Check for draft creation
        if (
          toolResult.toolName === "create_reply_draft" &&
          output?.success
        ) {
          const draftData = output.draft as {
            threadId: string;
            originalMessageId: string;
            recipientEmail: string;
            recipientName?: string;
            subject: string;
            body: string;
            threadContext?: string;
          };

          // Store the draft in the database
          const savedDraft = await createInboxDraft({
            session_id: sessionId,
            transcription,
            thread_id: draftData.threadId,
            original_message_id: draftData.originalMessageId,
            recipient_email: draftData.recipientEmail,
            recipient_name: draftData.recipientName,
            subject: draftData.subject,
            body: draftData.body,
            thread_context: draftData.threadContext,
          });

          const response: DraftResponse = {
            type: "draft",
            draft: {
              id: savedDraft.id,
              sessionId: savedDraft.session_id,
              version: savedDraft.version,
              status: savedDraft.status,
              threadId: savedDraft.thread_id,
              originalMessageId: savedDraft.original_message_id,
              recipientEmail: savedDraft.recipient_email,
              recipientName: savedDraft.recipient_name,
              subject: savedDraft.subject,
              body: savedDraft.body,
              threadContext: savedDraft.thread_context,
            },
          };
          return NextResponse.json(response);
        }
      }
    }

    // If we get here, the agent didn't produce a clarification or draft
    // Return an informational message
    const response: MessageResponse = {
      type: "message",
      message:
        result.text ||
        "I couldn't find any matching emails. Try being more specific about the sender name or subject.",
      sessionId,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in inbox assistant compose:", error);

    // Handle specific error types
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("Gmail not connected")) {
      return NextResponse.json(
        {
          type: "error",
          error: "Please connect your Gmail account",
          code: "GMAIL_NOT_CONNECTED",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        type: "error",
        error: errorMessage,
        code: "COMPOSE_FAILED",
      },
      { status: 500 }
    );
  }
}
