import { request } from "./client";

export type ProjectStatus =
  "draft" | "active" | "on_hold" | "completed" | "cancelled";
export type ProjectPriority = "low" | "medium" | "high" | "urgent";
export type ProjectMemberRole =
  "project_manager" | "member" | "client_contact" | "viewer";
export type ProjectServiceStatus =
  "planned" | "active" | "paused" | "completed" | "cancelled";

export interface Project {
  id: string;
  projectCode: string;
  clientCompanyId: string;
  clientCompany?: {
    id: string;
    code: string;
    clientCode?: string;
    name: string;
  } | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  projectManagerUserId?: string | null;
  projectManager?: { id: string; full_name?: string; email?: string } | null;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: unknown[];
  services?: unknown[];
  currentProjectRole?: ProjectMemberRole;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function paramsFrom(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const projectsApi = {
  getAdminProjects(
    filters: {
      q?: string;
      clientCompanyId?: string;
      status?: ProjectStatus;
      priority?: ProjectPriority;
      projectManagerUserId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    return request<Paginated<Project>>(
      `/admin/projects?${paramsFrom(filters)}`,
    );
  },

  getAdminProject(projectId: string) {
    return request<Project>(`/admin/projects/${projectId}`);
  },

  createProject(data: {
    projectCode: string;
    clientCompanyId: string;
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    projectManagerUserId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
  }) {
    return request<Project>("/admin/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateProject(projectId: string, data: Record<string, unknown>) {
    return request<Project>(`/admin/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getMembers(projectId: string) {
    return request<any[]>(`/admin/projects/${projectId}/members`);
  },
  addMember(
    projectId: string,
    data: { userId: string; projectRole: ProjectMemberRole },
  ) {
    return request(`/admin/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateMember(
    projectId: string,
    membershipId: string,
    projectRole: ProjectMemberRole,
  ) {
    return request(`/admin/projects/${projectId}/members/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectRole }),
    });
  },
  removeMember(projectId: string, membershipId: string) {
    return request(`/admin/projects/${projectId}/members/${membershipId}`, {
      method: "DELETE",
    });
  },

  getProjectServices(projectId: string) {
    return request<any[]>(`/admin/projects/${projectId}/services`);
  },
  addProjectService(
    projectId: string,
    data: {
      serviceId: string;
      status: ProjectServiceStatus;
      notes?: string | null;
    },
  ) {
    return request(`/admin/projects/${projectId}/services`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateProjectService(
    projectId: string,
    projectServiceId: string,
    data: { status?: ProjectServiceStatus; notes?: string | null },
  ) {
    return request(
      `/admin/projects/${projectId}/services/${projectServiceId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
  },
  removeProjectService(projectId: string, projectServiceId: string) {
    return request(
      `/admin/projects/${projectId}/services/${projectServiceId}`,
      { method: "DELETE" },
    );
  },

  getInternalProjects(page = 1, pageSize = 20) {
    return request<Paginated<Project>>(
      `/projects?${paramsFrom({ page, pageSize })}`,
    );
  },
  getInternalProject(projectId: string) {
    return request<Project>(`/projects/${projectId}`);
  },
  getClientProjects(page = 1, pageSize = 20) {
    return request<Paginated<Project>>(
      `/client/me/projects?${paramsFrom({ page, pageSize })}`,
    );
  },
  getClientProject(projectId: string) {
    return request<Project>(`/client/me/projects/${projectId}`);
  },
};
