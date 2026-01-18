import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
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

    console.log("=== Voice Compose Debug ===");
    console.log("Transcription:", transcription);

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
      prompt: `The user dictated the following email request:\n\n"${transcription}"\n\nCompose an email based on this request. Follow these steps:\n1. Use search_contacts to find the recipient\n2. Use create_draft to generate the final email\n\nYou MUST call the create_draft tool with the composed email. Do not stop until create_draft is called.`,
      tools: emailComposerTools,
      stopWhen: [hasToolCall('create_draft'), stepCountIs(10)],
    });

    // Log AI execution results
    console.log("AI Steps:", result.steps.length);
    for (const step of result.steps) {
      console.log("Step tool calls:", step.toolCalls?.map(tc => tc.toolName));
      console.log("Step tool results:", JSON.stringify(step.toolResults, null, 2));
    }

    // Find the create_draft tool result
    let draftData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        if (toolResult.toolName === "create_draft" && toolResult.output?.success) {
          draftData = toolResult.output.draft;
        }
      }
    }

    if (!draftData) {
      console.log("No draft created! AI text response:", result.text);
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
