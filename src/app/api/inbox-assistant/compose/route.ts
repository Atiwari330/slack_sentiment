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
import {
  routeEmail,
  getModelRoutingConfig,
  type Classification,
} from "@/lib/model-routing";

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

interface ClassificationInfo {
  category: string;
  tier: string;
  reason: string;
  isHighStakes: boolean;
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
  classification?: ClassificationInfo;
  modelUsed?: string;
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

    if (!gatewayKey && !openaiKey) {
      return NextResponse.json(
        { type: "error", error: "AI provider not configured", code: "AI_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // Session ID - use existing or create new
    const sessionId = existingSessionId || uuidv4();

    // Build dynamic system prompt with user context
    const baseSystemPrompt = await buildInboxAssistantPrompt();

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

    // Check if model routing is enabled
    const routingConfig = getModelRoutingConfig();
    let classification: Classification | null = null;
    let modelUsed: string | null = null;
    let systemPrompt = baseSystemPrompt;
    let model;

    if (routingConfig.enabled) {
      // Phase 1: Use light model for initial search and context gathering
      // We'll do full classification after gathering thread context
      const defaultModelId = process.env.AI_MODEL || "openai/gpt-4o";
      if (gatewayKey) {
        const gateway = createGateway({ apiKey: gatewayKey });
        model = gateway(routingConfig.lightModel);
      } else {
        const openai = createOpenAI({ apiKey: openaiKey });
        const modelName = routingConfig.lightModel.includes("/")
          ? routingConfig.lightModel.split("/")[1]
          : routingConfig.lightModel;
        model = openai(modelName);
      }
      modelUsed = routingConfig.lightModel;
      console.log("Initial phase using light model:", routingConfig.lightModel);
    } else {
      // Routing disabled - use default model
      const defaultModelId = process.env.AI_MODEL || "openai/gpt-4o";
      if (gatewayKey) {
        const gateway = createGateway({ apiKey: gatewayKey });
        model = gateway(defaultModelId);
      } else {
        const openai = createOpenAI({ apiKey: openaiKey });
        model = openai(defaultModelId);
      }
      modelUsed = process.env.AI_MODEL || "openai/gpt-4o";
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

    // Extract thread context from get_thread calls for classification
    let threadContext: string | null = null;
    let threadSubject: string | null = null;
    let senderInfo: { name?: string; email?: string } = {};

    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as Record<string, unknown> | undefined;
        if (toolResult.toolName === "get_thread" && output?.success) {
          const thread = output.thread as {
            formattedContext?: string;
            latestMessage?: {
              from?: string;
              subject?: string;
            };
          };
          threadContext = thread.formattedContext || null;
          threadSubject = thread.latestMessage?.subject || null;
          // Parse sender from "Name <email>" format
          const fromMatch = thread.latestMessage?.from?.match(/^(.+?)\s*<(.+?)>$/);
          if (fromMatch) {
            senderInfo = { name: fromMatch[1].trim(), email: fromMatch[2].trim() };
          } else {
            senderInfo = { email: thread.latestMessage?.from };
          }
        }
      }
    }

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

          // Perform classification if routing is enabled and we have thread context
          let classificationInfo: ClassificationInfo | undefined;

          if (routingConfig.enabled && (threadContext || draftData.threadContext)) {
            try {
              const routingResult = await routeEmail({
                input: {
                  threadContent: threadContext || draftData.threadContext || "",
                  subject: threadSubject || draftData.subject,
                  senderName: senderInfo.name || draftData.recipientName,
                  senderEmail: senderInfo.email || draftData.recipientEmail,
                },
                basePrompt: baseSystemPrompt,
                sessionId,
              });

              classification = routingResult.classification;
              classificationInfo = routingResult.classificationSummary;
              modelUsed = routingResult.modelId;

              console.log("=== Classification Result ===");
              console.log("Category:", classification.category);
              console.log("Tier:", classification.tier);
              console.log("Model:", modelUsed);
              console.log("Is High-Stakes:", classificationInfo.isHighStakes);

              // If high-stakes, we should regenerate the draft with the frontier model
              // For now, we'll include the classification info and let the user know
              // A more advanced implementation could re-run the draft generation
              if (classificationInfo.isHighStakes) {
                console.log("High-stakes email detected - classification info included in response");
              }
            } catch (classifyError) {
              console.error("Classification failed:", classifyError);
              // Continue without classification on error
            }
          }

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
            classification: classificationInfo,
            modelUsed: modelUsed || undefined,
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
