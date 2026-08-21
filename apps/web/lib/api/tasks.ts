import type { Paginated } from "./projects";
import { request } from "./client";

export type TaskStatus =
  "todo" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectTask {
  id: string;
  project_id: string;
  parent_task_id?: string | null;
  project_service_item_id?: string | null;
  project_service_item_code?: string | null;
  task_code?: string | null;
  taskCode?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_user_id?: string | null;
  assignee?: { id: string; full_name?: string; email?: string } | null;
  reporter_user_id?: string | null;
  reporter?: { id: string; full_name?: string; email?: string } | null;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  canUpdateStatus: boolean;
}

export const tasksApi = {
  list(
    projectId: string,
    filters: {
      q?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeUserId?: string;
      parentTaskId?: string;
      projectServiceItemId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return request<Paginated<ProjectTask>>(
      `/projects/${projectId}/tasks?${params.toString()}`,
    );
  },
  get(projectId: string, taskId: string) {
    return request<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`);
  },
  create(
    projectId: string,
    data: {
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeUserId?: string | null;
      parentTaskId?: string | null;
      projectServiceItemId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      sortOrder?: number;
    },
  ) {
    return request<ProjectTask>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  update(
    projectId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeUserId?: string | null;
      parentTaskId?: string | null;
      projectServiceItemId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
      sortOrder?: number;
    },
  ) {
    return request<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
