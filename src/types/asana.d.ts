declare module "asana" {
  interface ApiClient {
    instance: {
      authentications: {
        token: {
          accessToken: string;
        };
      };
    };
  }

  interface UsersApi {
    getUser(userGid: string, opts?: { opt_fields?: string }): Promise<{ data: User }>;
    getUsersForWorkspace(
      workspaceGid: string,
      opts?: { opt_fields?: string }
    ): Promise<{ data: User[] }>;
  }

  interface User {
    gid: string;
    name: string;
    email?: string;
  }

  interface TasksApi {
    createTask(opts: {
      data: {
        name: string;
        notes?: string;
        projects?: string[];
        memberships?: Array<{ project: string; section: string }>;
        assignee?: string;
      };
    }): Promise<{ data: Task }>;
    createSubtaskForTask(
      taskGid: string,
      opts: {
        data: {
          name: string;
          assignee?: string;
        };
      }
    ): Promise<{ data: Task }>;
  }

  interface Task {
    gid: string;
    name: string;
    permalink_url?: string;
  }

  interface ProjectsApi {
    getProjects(opts?: {
      workspace?: string;
      limit?: number;
      opt_fields?: string;
    }): Promise<{ data: Project[] }>;
    getProjectsForWorkspace(
      workspaceGid: string,
      opts?: { limit?: number; opt_fields?: string }
    ): Promise<{ data: Project[] }>;
    getProject(
      projectGid: string,
      opts?: { opt_fields?: string }
    ): Promise<{ data: Project }>;
  }

  interface Project {
    gid: string;
    name: string;
    workspace?: { gid: string };
  }

  interface SectionsApi {
    getSectionsForProject(
      projectGid: string,
      opts?: { opt_fields?: string }
    ): Promise<{ data: Section[] }>;
  }

  interface Section {
    gid: string;
    name: string;
  }

  interface WorkspacesApi {
    getWorkspaces(opts?: Record<string, unknown>): Promise<{ data: Workspace[] }>;
  }

  interface Workspace {
    gid: string;
    name: string;
  }

  const ApiClient: ApiClient;
  const UsersApi: new () => UsersApi;
  const TasksApi: new () => TasksApi;
  const ProjectsApi: new () => ProjectsApi;
  const SectionsApi: new () => SectionsApi;
  const WorkspacesApi: new () => WorkspacesApi;
}
