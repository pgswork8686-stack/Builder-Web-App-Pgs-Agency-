import type { ProjectTask, TaskPriority, TaskStatus } from "./tasks";
import { request } from "./client";

export type BoardStatus = Exclude<TaskStatus, "cancelled">;

export interface BoardTask extends ProjectTask {
  canReorder: boolean;
}

export interface ProjectBoard {
  todo: BoardTask[];
  inProgress: BoardTask[];
  review: BoardTask[];
  done: BoardTask[];
  canReorder: boolean;
  total: number;
  truncated: boolean;
  limit: number;
}

export interface CalendarTask {
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  startDate?: string | null;
  dueDate?: string | null;
}

function paramsFrom(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

export const workspaceApi = {
  board(
    projectId: string,
    filters: {
      q?: string;
      assigneeUserId?: string;
      priority?: TaskPriority;
      status?: BoardStatus;
    } = {},
  ) {
    return request<ProjectBoard>(
      `/projects/${projectId}/board?${paramsFrom(filters)}`,
    );
  },
  calendar(projectId: string, from: string, to: string) {
    return request<CalendarTask[]>(
      `/projects/${projectId}/calendar?${paramsFrom({ from, to })}`,
    );
  },
  moveTask(
    projectId: string,
    taskId: string,
    data: {
      status: BoardStatus;
      beforeTaskId?: string | null;
      afterTaskId?: string | null;
    },
  ) {
    return request<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/move`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
