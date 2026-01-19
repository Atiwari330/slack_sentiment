import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { brainDumpComposerTools, BRAIN_DUMP_COMPOSER_SYSTEM_PROMPT } from "@/lib/agents/brain-dump-composer";
import { createBrainDumpRun } from "@/lib/db/brain-dump-runs";

export const maxDuration = 60;

// POST /api/brain-dump/compose - Generate Slack and Asana drafts from brain dump
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, slackChannelId, slackChannelName } = body;

    if (!transcription) {
      return NextResponse.json(
        { error: "transcription is required" },
        { status: 400 }
      );
    }

    if (!slackChannelId || !slackChannelName) {
      return NextResponse.json(
        { error: "slackChannelId and slackChannelName are required" },
        { status: 400 }
      );
    }

    console.log("=== Brain Dump Compose Debug ===");
    console.log("Transcription:", transcription);
    console.log("Slack Channel:", slackChannelName);

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

    // Generate drafts using the agent
    const result = await generateText({
      model,
      system: BRAIN_DUMP_COMPOSER_SYSTEM_PROMPT,
      prompt: `The user provided the following brain dump:\n\n"${transcription}"\n\nProcess this brain dump and create both a Slack message draft and an Asana task draft. Follow these steps:\n1. Use search_contacts to find the team member mentioned (they are the ASSIGNEE)\n2. Use lookup_slack_user with their email to get their Slack user ID for @mentioning\n3. Use create_drafts to generate both drafts\n\nRemember: The contact is the ASSIGNEE who will DO the work. The Asana task is FOR them, not about them.\n\nYou MUST call the create_drafts tool with the composed drafts. Do not stop until create_drafts is called.`,
      tools: brainDumpComposerTools,
      stopWhen: [hasToolCall('create_drafts'), stepCountIs(10)],
    });

    // Log AI execution results
    console.log("AI Steps:", result.steps.length);
    for (const step of result.steps) {
      console.log("Step tool calls:", step.toolCalls?.map(tc => tc.toolName));
    }

    // Find the create_drafts tool result
    let draftsData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as { success?: boolean; drafts?: unknown } | undefined;
        if (toolResult.toolName === "create_drafts" && output?.success) {
          draftsData = output.drafts as {
            contact: { id: string; name: string; email: string; slackUserId: string | null };
            asana: { projectId: string | null; projectName: string | null };
            slack: { message: string };
            asanaTask: { taskTitle: string; taskDescription: string; subtasks: string[] };
          };
        }
      }
    }

    if (!draftsData) {
      console.log("No drafts created! AI text response:", result.text);
      return NextResponse.json(
        { error: "Failed to compose drafts. Please try again with more details." },
        { status: 400 }
      );
    }

    // Store the brain dump run in the database
    const savedRun = await createBrainDumpRun({
      input_transcript: transcription,
      slack_channel_id: slackChannelId,
      slack_channel_name: slackChannelName,
      contact_id: draftsData.contact.id || undefined,
      contact_name: draftsData.contact.name,
      contact_email: draftsData.contact.email,
      slack_user_id: draftsData.contact.slackUserId || undefined,
      asana_project_id: draftsData.asana.projectId || undefined,
      asana_project_name: draftsData.asana.projectName || undefined,
      draft_slack: draftsData.slack,
      draft_asana: {
        taskTitle: draftsData.asanaTask.taskTitle,
        taskDescription: draftsData.asanaTask.taskDescription,
        subtasks: draftsData.asanaTask.subtasks,
      },
    });

    return NextResponse.json({
      run: {
        id: savedRun.id,
        status: savedRun.status,
        slackChannel: {
          id: savedRun.slack_channel_id,
          name: savedRun.slack_channel_name,
        },
        contact: {
          id: savedRun.contact_id,
          name: savedRun.contact_name,
          email: savedRun.contact_email,
        },
        asanaProject: {
          id: savedRun.asana_project_id,
          name: savedRun.asana_project_name,
        },
        drafts: {
          slack: savedRun.draft_slack,
          asana: savedRun.draft_asana,
        },
      },
    });
  } catch (error) {
    console.error("Error composing brain dump:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compose brain dump" },
      { status: 500 }
    );
  }
}
