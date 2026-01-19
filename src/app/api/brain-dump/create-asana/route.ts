import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getInboxSection, createTaskInSection } from "@/lib/asana";
import { getBrainDumpRunById, markAsanaCreated } from "@/lib/db/brain-dump-runs";

// POST /api/brain-dump/create-asana - Create the Asana task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json(
        { error: "runId is required" },
        { status: 400 }
      );
    }

    if (!process.env.ASANA_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Asana not configured" },
        { status: 500 }
      );
    }

    // Get the run
    const run = await getBrainDumpRunById(runId);
    if (!run) {
      return NextResponse.json(
        { error: "Brain dump run not found" },
        { status: 404 }
      );
    }

    if (!run.draft_asana) {
      return NextResponse.json(
        { error: "No Asana draft found" },
        { status: 400 }
      );
    }

    if (!run.asana_project_id) {
      return NextResponse.json(
        { error: "No Asana project configured for this contact. Please update the contact settings." },
        { status: 400 }
      );
    }

    // Check if already created
    if (run.asana_task_gid) {
      return NextResponse.json(
        { error: "Asana task already created" },
        { status: 400 }
      );
    }

    console.log("=== Creating Asana Task ===");
    console.log("Project:", run.asana_project_name);
    console.log("Task:", run.draft_asana.taskTitle);
    console.log("Contact Email:", run.contact_email);

    // Look up Asana user by contact email for assignment
    let assigneeGid: string | undefined;
    if (run.contact_email) {
      const asanaUser = await getUserByEmail(run.contact_email);
      if (asanaUser) {
        assigneeGid = asanaUser.gid;
        console.log("Found Asana user:", asanaUser.name);
      } else {
        console.log("No Asana user found for email:", run.contact_email);
      }
    }

    // Find the "inbox" section in the project
    const inboxSection = await getInboxSection(run.asana_project_id);
    if (!inboxSection) {
      return NextResponse.json(
        { error: "Could not find 'inbox' section in the Asana project. Please create a section named 'inbox' (case-insensitive)." },
        { status: 400 }
      );
    }

    console.log("Found inbox section:", inboxSection.name);

    // Create the task in the inbox section
    const result = await createTaskInSection({
      projectGid: run.asana_project_id,
      sectionGid: inboxSection.gid,
      assigneeGid,
      name: run.draft_asana.taskTitle,
      notes: run.draft_asana.taskDescription,
      subtasks: run.draft_asana.subtasks,
    });

    console.log("Task created:", result.taskGid);
    console.log("Task URL:", result.taskUrl);

    // Mark as created
    const updatedRun = await markAsanaCreated(runId, result.taskGid, result.taskUrl);

    return NextResponse.json({
      success: true,
      taskGid: result.taskGid,
      taskUrl: result.taskUrl,
      subtaskCount: result.subtaskGids.length,
      assignee: assigneeGid ? run.contact_email : null,
      status: updatedRun.status,
    });
  } catch (error) {
    console.error("Error creating Asana task:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Asana task" },
      { status: 500 }
    );
  }
}
