import type { Paginated } from "./projects";
import { request } from "./client";

export interface TaskComment {
  id: string;
  taskId: string;
  authorUserId: string;
  author?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
  content: string;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export const commentsApi = {
  list(projectId: string, taskId: string, page = 1, pageSize = 20) {
    return request<Paginated<TaskComment>>(
      `/projects/${projectId}/tasks/${taskId}/comments?page=${page}&pageSize=${pageSize}`,
    );
  },
  create(projectId: string, taskId: string, content: string) {
    return request<TaskComment>(
      `/projects/${projectId}/tasks/${taskId}/comments`,
      { method: "POST", body: JSON.stringify({ content }) },
    );
  },
  update(
    projectId: string,
    taskId: string,
    commentId: string,
    content: string,
  ) {
    return request<TaskComment>(
      `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
      { method: "PATCH", body: JSON.stringify({ content }) },
    );
  },
  remove(projectId: string, taskId: string, commentId: string) {
    return request<{ success: boolean }>(
      `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
      { method: "DELETE" },
    );
  },
};
