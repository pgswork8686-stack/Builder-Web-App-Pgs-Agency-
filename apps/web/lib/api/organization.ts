import { request } from "./client";

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  return request(url, options);
};

export const organizationApi = {
  // Departments
  async getDepartments() {
    return fetchWithAuth("/admin/departments");
  },
  async getDepartmentById(id: string) {
    return fetchWithAuth(`/admin/departments/${id}`);
  },
  async createDepartment(data: {
    code: string;
    name: string;
    description?: string;
  }) {
    return fetchWithAuth("/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateDepartment(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    return fetchWithAuth(`/admin/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Teams
  async getTeams(filters?: {
    departmentId?: string;
    isActive?: boolean;
    q?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.departmentId)
      params.append("departmentId", filters.departmentId);
    if (filters?.isActive !== undefined)
      params.append("isActive", String(filters.isActive));
    if (filters?.q) params.append("q", filters.q);

    return fetchWithAuth(`/admin/teams?${params.toString()}`);
  },
  async getTeamById(id: string) {
    return fetchWithAuth(`/admin/teams/${id}`);
  },
  async createTeam(data: {
    departmentId: string;
    code: string;
    name: string;
    leaderUserId?: string | null;
    description?: string;
  }) {
    return fetchWithAuth("/admin/teams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateTeam(
    id: string,
    data: {
      name?: string;
      leaderUserId?: string | null;
      description?: string | null;
      isActive?: boolean;
    },
  ) {
    return fetchWithAuth(`/admin/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
