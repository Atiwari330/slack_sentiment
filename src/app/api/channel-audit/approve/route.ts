import { NextResponse } from "next/server";
import { postMessage } from "@/lib/slack";
import {
  getInboxSection,
  createTaskInSection,
  getUserByEmail,
} from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === "slack") {
      // Execute Slack message
      const { channelId, message } = body;

      if (!channelId || !message) {
        return NextResponse.json(
          { error: "Channel ID and message are required" },
          { status: 400 }
        );
      }

      const messageTs = await postMessage(channelId, message);

      return NextResponse.json({
        success: true,
        type: "slack",
        messageTs,
        message: "Message sent successfully",
      });
    } else if (type === "asana") {
      // Execute Asana task creation
      const { projectId, taskTitle, taskDescription, subtasks, assigneeEmail } =
        body;

      if (!projectId || !taskTitle) {
        return NextResponse.json(
          { error: "Project ID and task title are required" },
          { status: 400 }
        );
      }

      // Find the inbox section
      const inboxSection = await getInboxSection(projectId);
      if (!inboxSection) {
        return NextResponse.json(
          { error: "Could not find inbox section in the project" },
          { status: 400 }
        );
      }

      // Look up assignee if email provided
      let assigneeGid: string | undefined;
      if (assigneeEmail) {
        const asanaUser = await getUserByEmail(assigneeEmail);
        if (asanaUser) {
          assigneeGid = asanaUser.gid;
        }
      }

      // Create the task
      const result = await createTaskInSection({
        projectGid: projectId,
        sectionGid: inboxSection.gid,
        assigneeGid,
        name: taskTitle,
        notes: taskDescription || "",
        subtasks: subtasks || [],
      });

      return NextResponse.json({
        success: true,
        type: "asana",
        taskGid: result.taskGid,
        taskUrl: result.taskUrl,
        subtaskCount: result.subtaskGids.length,
        message: "Task created successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'slack' or 'asana'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Channel audit approve API error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
