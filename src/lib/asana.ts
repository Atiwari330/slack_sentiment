import Asana from "asana";

// Initialize Asana client with Personal Access Token
const client = Asana.ApiClient.instance;
const tokenAuth = client.authentications["token"];
tokenAuth.accessToken = process.env.ASANA_ACCESS_TOKEN!;

const tasksApi = new Asana.TasksApi();
const projectsApi = new Asana.ProjectsApi();
const usersApi = new Asana.UsersApi();
const workspacesApi = new Asana.WorkspacesApi();
const sectionsApi = new Asana.SectionsApi();

export interface AsanaProject {
  gid: string;
  name: string;
  workspaceGid: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email: string;
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface CreateTaskResult {
  taskGid: string;
  taskUrl: string;
  subtaskGids: string[];
}

/**
 * Get the default workspace GID (first workspace found)
 */
async function getDefaultWorkspaceGid(): Promise<string> {
  const response = await workspacesApi.getWorkspaces({});
  const workspaces = response.data;
  if (!workspaces || workspaces.length === 0) {
    throw new Error("No Asana workspaces found");
  }
  return workspaces[0].gid;
}

/**
 * Get all projects the user has access to (for contact edit dropdown)
 */
export async function getProjects(): Promise<AsanaProject[]> {
  const workspaceGid = await getDefaultWorkspaceGid();

  const response = await projectsApi.getProjects({
    workspace: workspaceGid,
    opt_fields: "gid,name",
  });

  const projects: AsanaProject[] = [];
  for (const project of response.data || []) {
    if (project.gid && project.name) {
      projects.push({
        gid: project.gid,
        name: project.name,
        workspaceGid,
      });
    }
  }

  // Sort alphabetically by name
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Lookup Asana user by email address (for assignee)
 */
export async function getUserByEmail(email: string): Promise<AsanaUser | null> {
  try {
    const workspaceGid = await getDefaultWorkspaceGid();

    // Get users in the workspace and find by email
    const response = await usersApi.getUsersForWorkspace(workspaceGid, {
      opt_fields: "gid,name,email",
    });

    for (const user of response.data || []) {
      if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
        return {
          gid: user.gid,
          name: user.name || "",
          email: user.email,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error looking up Asana user by email:", error);
    return null;
  }
}

/**
 * Find the "inbox" section in a project (case-insensitive match)
 */
export async function getInboxSection(projectGid: string): Promise<AsanaSection | null> {
  try {
    const response = await sectionsApi.getSectionsForProject(projectGid, {
      opt_fields: "gid,name",
    });

    for (const section of response.data || []) {
      if (section.name && section.name.toLowerCase() === "inbox") {
        return {
          gid: section.gid,
          name: section.name,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding inbox section:", error);
    return null;
  }
}

/**
 * Create a task in a specific section with optional subtasks
 */
export async function createTaskInSection(options: {
  projectGid: string;
  sectionGid: string;
  assigneeGid?: string;
  name: string;
  notes: string;
  subtasks?: string[];
}): Promise<CreateTaskResult> {
  const { projectGid, sectionGid, assigneeGid, name, notes, subtasks = [] } = options;

  // Create the main task
  const taskResponse = await tasksApi.createTask({
    data: {
      name,
      notes,
      projects: [projectGid],
      memberships: [
        {
          project: projectGid,
          section: sectionGid,
        },
      ],
      assignee: assigneeGid || undefined,
    },
  });

  const task = taskResponse.data;
  if (!task || !task.gid) {
    throw new Error("Failed to create Asana task");
  }

  const taskGid = task.gid;
  const subtaskGids: string[] = [];

  // Create subtasks
  for (const subtaskName of subtasks) {
    try {
      const subtaskResponse = await tasksApi.createSubtaskForTask(taskGid, {
        data: {
          name: subtaskName,
          assignee: assigneeGid || undefined,
        },
      });
      if (subtaskResponse.data?.gid) {
        subtaskGids.push(subtaskResponse.data.gid);
      }
    } catch (error) {
      console.error(`Failed to create subtask "${subtaskName}":`, error);
    }
  }

  // Generate task URL
  const taskUrl = `https://app.asana.com/0/${projectGid}/${taskGid}`;

  return {
    taskGid,
    taskUrl,
    subtaskGids,
  };
}

/**
 * Get a single project by GID
 */
export async function getProjectById(projectGid: string): Promise<AsanaProject | null> {
  try {
    const response = await projectsApi.getProject(projectGid, {
      opt_fields: "gid,name,workspace",
    });

    const project = response.data;
    if (!project || !project.gid) {
      return null;
    }

    return {
      gid: project.gid,
      name: project.name || "",
      workspaceGid: project.workspace?.gid || "",
    };
  } catch (error) {
    console.error("Error getting project by ID:", error);
    return null;
  }
}
