import { NextRequest, NextResponse } from "next/server";
import { generateText, createGateway, hasToolCall, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { brainDumpComposerTools, BRAIN_DUMP_REVISER_SYSTEM_PROMPT } from "@/lib/agents/brain-dump-composer";
import { getBrainDumpRunById, updateBrainDumpDrafts, addRevisionFeedback } from "@/lib/db/brain-dump-runs";

export const maxDuration = 60;

// POST /api/brain-dump/revise - Revise drafts based on feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, feedback } = body;

    if (!runId) {
      return NextResponse.json(
        { error: "runId is required" },
        { status: 400 }
      );
    }

    if (!feedback) {
      return NextResponse.json(
        { error: "feedback is required" },
        { status: 400 }
      );
    }

    // Get the existing run
    const run = await getBrainDumpRunById(runId);
    if (!run) {
      return NextResponse.json(
        { error: "Brain dump run not found" },
        { status: 404 }
      );
    }

    console.log("=== Brain Dump Revise Debug ===");
    console.log("Run ID:", runId);
    console.log("Feedback:", feedback);

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

    // Build context from current drafts
    const currentSlack = run.draft_slack?.message || "";
    const currentAsana = run.draft_asana || { taskTitle: "", taskDescription: "", subtasks: [] };

    const prompt = `Here are the current drafts:

## Current Slack Message:
${currentSlack}

## Current Asana Task:
Title: ${currentAsana.taskTitle}
Description: ${currentAsana.taskDescription}
Subtasks:
${currentAsana.subtasks.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## User Feedback:
"${feedback}"

Please revise the drafts based on this feedback. Use create_drafts with the updated content.

Contact info to use:
- ID: ${run.contact_id || "unknown"}
- Name: ${run.contact_name}
- Email: ${run.contact_email}
- Asana Project ID: ${run.asana_project_id || "none"}
- Asana Project Name: ${run.asana_project_name || "none"}`;

    // Generate revised drafts using the agent
    const result = await generateText({
      model,
      system: BRAIN_DUMP_REVISER_SYSTEM_PROMPT,
      prompt,
      tools: brainDumpComposerTools,
      stopWhen: [hasToolCall('create_drafts'), stepCountIs(10)],
    });

    // Find the create_drafts tool result
    let draftsData = null;
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        const output = toolResult.output as { success?: boolean; drafts?: unknown } | undefined;
        if (toolResult.toolName === "create_drafts" && output?.success) {
          draftsData = output.drafts as {
            contact: { id: string; name: string; email: string };
            asana: { projectId: string | null; projectName: string | null };
            slack: { message: string };
            asanaTask: { taskTitle: string; taskDescription: string; subtasks: string[] };
          };
        }
      }
    }

    if (!draftsData) {
      console.log("No revised drafts created! AI text response:", result.text);
      return NextResponse.json(
        { error: "Failed to revise drafts. Please try again." },
        { status: 400 }
      );
    }

    // Add feedback to revision history
    await addRevisionFeedback(runId, feedback);

    // Update the drafts
    const updatedRun = await updateBrainDumpDrafts(runId, {
      draft_slack: draftsData.slack,
      draft_asana: {
        taskTitle: draftsData.asanaTask.taskTitle,
        taskDescription: draftsData.asanaTask.taskDescription,
        subtasks: draftsData.asanaTask.subtasks,
      },
    });

    return NextResponse.json({
      run: {
        id: updatedRun.id,
        status: updatedRun.status,
        slackChannel: {
          id: updatedRun.slack_channel_id,
          name: updatedRun.slack_channel_name,
        },
        contact: {
          id: updatedRun.contact_id,
          name: updatedRun.contact_name,
          email: updatedRun.contact_email,
        },
        asanaProject: {
          id: updatedRun.asana_project_id,
          name: updatedRun.asana_project_name,
        },
        drafts: {
          slack: updatedRun.draft_slack,
          asana: updatedRun.draft_asana,
        },
      },
    });
  } catch (error) {
    console.error("Error revising brain dump:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise brain dump" },
      { status: 500 }
    );
  }
}
