import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { emailComposerTools, EMAIL_REVISER_SYSTEM_PROMPT } from "@/lib/agents/email-composer";
import { getLatestDraft, createRevision } from "@/lib/db/email-drafts";

export const maxDuration = 60;

// POST /api/voice/revise - Revise an email draft based on feedback
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
    const currentDraft = await getLatestDraft(sessionId);
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

    // Generate revised email using the agent
    const prompt = `Current email draft:

To: ${currentDraft.recipient_name} <${currentDraft.recipient_email}>
Subject: ${currentDraft.subject}

${currentDraft.body}

---

User feedback: "${feedback}"

Please revise the email according to the feedback. Use create_draft to submit the revised version.`;

    const result = await generateText({
      model,
      system: EMAIL_REVISER_SYSTEM_PROMPT,
      prompt,
      tools: emailComposerTools,
      stopWhen: [hasToolCall('create_draft'), stepCountIs(3)],
    });

    // Find the create_draft tool result
    let draftData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as { success?: boolean; draft?: unknown } | undefined;
        if (toolResult.toolName === "create_draft" && output?.success) {
          draftData = output.draft as {
            recipientEmail: string;
            recipientName: string;
            subject: string;
            body: string;
          };
        }
      }
    }

    if (!draftData) {
      return NextResponse.json(
        { error: "Failed to revise email. Please try again." },
        { status: 400 }
      );
    }

    // Create a new version of the draft
    const revisedDraft = await createRevision(sessionId, feedback, {
      subject: draftData.subject,
      body: draftData.body,
      recipient_email: draftData.recipientEmail,
      recipient_name: draftData.recipientName,
    });

    return NextResponse.json({
      draft: {
        id: revisedDraft.id,
        sessionId: revisedDraft.session_id,
        version: revisedDraft.version,
        status: revisedDraft.status,
        recipientEmail: revisedDraft.recipient_email,
        recipientName: revisedDraft.recipient_name,
        subject: revisedDraft.subject,
        body: revisedDraft.body,
        contactId: revisedDraft.contact_id,
        feedback: revisedDraft.feedback,
      },
    });
  } catch (error) {
    console.error("Error revising email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise email" },
      { status: 500 }
    );
  }
}
