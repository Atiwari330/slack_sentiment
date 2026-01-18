import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { emailComposerTools, EMAIL_COMPOSER_SYSTEM_PROMPT } from "@/lib/agents/email-composer";
import { createDraft } from "@/lib/db/email-drafts";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

// POST /api/voice/compose - Compose an email from voice transcription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription } = body;

    if (!transcription) {
      return NextResponse.json(
        { error: "transcription is required" },
        { status: 400 }
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

    // Generate email using the agent
    const result = await generateText({
      model,
      system: EMAIL_COMPOSER_SYSTEM_PROMPT,
      prompt: `The user dictated the following email request:\n\n"${transcription}"\n\nPlease compose an appropriate email. Use the available tools to find the recipient and gather context, then create the draft.`,
      tools: emailComposerTools,
      maxSteps: 5,
    });

    // Find the create_draft tool result
    let draftData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        if (toolResult.toolName === "create_draft" && toolResult.result?.success) {
          draftData = toolResult.result.draft;
        }
      }
    }

    if (!draftData) {
      // If no draft was created, try to extract from the response
      return NextResponse.json(
        { error: "Failed to compose email. Please try again with more details." },
        { status: 400 }
      );
    }

    // Create session ID for this email composition
    const sessionId = uuidv4();

    // Store the draft in the database
    const savedDraft = await createDraft({
      session_id: sessionId,
      transcription,
      contact_id: draftData.contactId,
      recipient_email: draftData.recipientEmail,
      recipient_name: draftData.recipientName,
      subject: draftData.subject,
      body: draftData.body,
    });

    return NextResponse.json({
      draft: {
        id: savedDraft.id,
        sessionId: savedDraft.session_id,
        version: savedDraft.version,
        status: savedDraft.status,
        recipientEmail: savedDraft.recipient_email,
        recipientName: savedDraft.recipient_name,
        subject: savedDraft.subject,
        body: savedDraft.body,
        contactId: savedDraft.contact_id,
      },
    });
  } catch (error) {
    console.error("Error composing email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compose email" },
      { status: 500 }
    );
  }
}
