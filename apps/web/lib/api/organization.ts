import { request } from "./client";

export interface DepartmentHeadInfo {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  employeeCode?: string | null;
}

export interface Department {
  id: string;
  departmentCode: string; // PB_01...
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive: boolean;
  is_active?: boolean;
  headUserId?: string | null;
  head_user_id?: string | null;
  headUserCode?: string | null;
  head_user_code?: string | null;
  head?: DepartmentHeadInfo | null;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}

export interface Team {
  id: string;
  departmentId?: string;
  department_id: string;
  teamCode?: string; // N_01...
  team_code?: string;
  code: string;
  name: string;
  description: string | null;
  leaderUserId?: string | null;
  leader_user_id: string | null;
  isActive?: boolean;
  is_active: boolean;
  department?: {
    name: string;
  };
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

const fetchWithAuth = async <T>(url: string, options: RequestInit = {}) => {
  return request<T>(url, options);
};

export const organizationApi = {
  // Departments
  async getDepartments() {
    return fetchWithAuth<Department[]>("/admin/departments");
  },
  async getDepartmentById(id: string) {
    return fetchWithAuth<Department>(`/admin/departments/${id}`);
  },
  async createDepartment(data: {
    code: string;
    name: string;
    description?: string;
    sortOrder?: number;
    headUserId?: string | null;
  }) {
    return fetchWithAuth<Department>("/admin/departments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateDepartment(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      sortOrder?: number;
      headUserId?: string | null;
      isActive?: boolean;
    },
  ) {
    return fetchWithAuth<Department>(`/admin/departments/${id}`, {
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

    return fetchWithAuth<Team[]>(`/admin/teams?${params.toString()}`);
  },
  async getTeamById(id: string) {
    return fetchWithAuth<Team>(`/admin/teams/${id}`);
  },
  async createTeam(data: {
    departmentId: string;
    code: string;
    name: string;
    leaderUserId?: string | null;
    description?: string;
  }) {
    return fetchWithAuth<Team>("/admin/teams", {
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
    return fetchWithAuth<Team>(`/admin/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
