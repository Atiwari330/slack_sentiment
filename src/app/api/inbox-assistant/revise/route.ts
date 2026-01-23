import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  inboxAssistantTools,
  INBOX_REVISER_SYSTEM_PROMPT,
} from "@/lib/agents/inbox-assistant";
import {
  getLatestInboxDraft,
  createInboxRevision,
} from "@/lib/db/inbox-drafts";

export const maxDuration = 60;

// POST /api/inbox-assistant/revise - Revise a reply draft based on feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, feedback } = body;

    if (!sessionId || !feedback) {
      return NextResponse.json(
        { error: "sessionId and feedback are required" },
        { status: 400 }
      );
    }

    // Get the current draft
    const currentDraft = await getLatestInboxDraft(sessionId);
    if (!currentDraft) {
      return NextResponse.json(
        { error: "No draft found for this session" },
        { status: 404 }
      );
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

    // Build the revision prompt
    let prompt = `Current reply draft:

To: ${currentDraft.recipient_name || ""} <${currentDraft.recipient_email}>
Subject: ${currentDraft.subject}

${currentDraft.body}`;

    // Include thread context if available
    if (currentDraft.thread_context) {
      prompt += `

---
Thread Context (for reference):
${currentDraft.thread_context}`;
    }

    prompt += `

---

User feedback: "${feedback}"

Please revise the email according to the feedback. Use create_reply_draft to submit the revised version.
Keep the threadId as "${currentDraft.thread_id}" and originalMessageId as "${currentDraft.original_message_id}".`;

    const result = await generateText({
      model,
      system: INBOX_REVISER_SYSTEM_PROMPT,
      prompt,
      tools: inboxAssistantTools,
      stopWhen: [hasToolCall("create_reply_draft"), stepCountIs(3)],
    });

    // Find the create_reply_draft tool result
    let draftData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as {
          success?: boolean;
          draft?: unknown;
        } | undefined;
        if (toolResult.toolName === "create_reply_draft" && output?.success) {
          draftData = output.draft as {
            threadId: string;
            originalMessageId: string;
            recipientEmail: string;
            recipientName?: string;
            subject: string;
            body: string;
            threadContext?: string;
          };
        }
      }
    }

    if (!draftData) {
      return NextResponse.json(
        { error: "Failed to revise reply. Please try again." },
        { status: 400 }
      );
    }

    // Create a new version of the draft
    const revisedDraft = await createInboxRevision(sessionId, feedback, {
      subject: draftData.subject,
      body: draftData.body,
      recipient_email: draftData.recipientEmail,
      recipient_name: draftData.recipientName,
    });

    return NextResponse.json({
      type: "draft",
      draft: {
        id: revisedDraft.id,
        sessionId: revisedDraft.session_id,
        version: revisedDraft.version,
        status: revisedDraft.status,
        threadId: revisedDraft.thread_id,
        originalMessageId: revisedDraft.original_message_id,
        recipientEmail: revisedDraft.recipient_email,
        recipientName: revisedDraft.recipient_name,
        subject: revisedDraft.subject,
        body: revisedDraft.body,
        threadContext: revisedDraft.thread_context,
        feedback: revisedDraft.feedback,
      },
    });
  } catch (error) {
    console.error("Error revising inbox reply:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to revise reply",
      },
      { status: 500 }
    );
  }
}
