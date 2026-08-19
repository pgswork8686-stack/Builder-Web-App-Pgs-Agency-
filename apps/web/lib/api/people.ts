import { request } from "./client";

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  return request(url, options);
};

export const peopleApi = {
  // Own organization context
  async getMyOrganization() {
    return fetchWithAuth("/me/organization");
  },

  // Team members (for Team Leader)
  async getTeamMembers() {
    return fetchWithAuth("/team/members");
  },

  // Admin directory
  async getPeopleDirectory(filters?: {
    q?: string;
    role?: string;
    departmentId?: string;
    teamId?: string;
    employmentStatus?: string;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.role) params.append("role", filters.role);
    if (filters?.departmentId)
      params.append("departmentId", filters.departmentId);
    if (filters?.teamId) params.append("teamId", filters.teamId);
    if (filters?.employmentStatus)
      params.append("employmentStatus", filters.employmentStatus);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.pageSize) params.append("pageSize", String(filters.pageSize));

    return fetchWithAuth(`/admin/people?${params.toString()}`);
  },

  async getPersonByUserId(userId: string) {
    return fetchWithAuth(`/admin/people/${userId}`);
  },

  async createEmploymentProfile(
    userId: string,
    data: {
      employeeCode: string;
      departmentId?: string | null;
      teamId?: string | null;
      jobTitle?: string | null;
      reportsToUserId?: string | null;
      employmentStatus: "probation" | "active" | "on_leave" | "terminated";
      joinedDate?: string | null;
    },
  ) {
    return fetchWithAuth(`/admin/people/${userId}/employment`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateEmploymentProfile(
    userId: string,
    data: {
      departmentId?: string | null;
      teamId?: string | null;
      jobTitle?: string | null;
      reportsToUserId?: string | null;
      employmentStatus?: "probation" | "active" | "on_leave" | "terminated";
      joinedDate?: string | null;
      leftDate?: string | null;
    },
  ) {
    return fetchWithAuth(`/admin/people/${userId}/employment`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async updatePersonFull(
    userId: string,
    data: {
      fullName?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      role?: "admin" | "team_leader" | "employee" | "accountant" | "client";
      accountStatus?:
        "pending" | "active" | "suspended" | "terminated" | "rejected";
      employeeCode?: string | null;
      departmentId?: string | null;
      teamId?: string | null;
      jobTitle?: string | null;
      employmentStatus?: "probation" | "active" | "on_leave" | "terminated";
      joinedDate?: string | null;
    },
  ) {
    return fetchWithAuth(`/admin/people/${userId}/full`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deletePerson(userId: string) {
    return fetchWithAuth(`/admin/people/${userId}`, {
      method: "DELETE",
    });
  },

  async getUserProjects(userId: string) {
    return fetchWithAuth(`/admin/people/${userId}/projects`);
  },

  async assignUserProjects(
    userId: string,
    data: {
      projectIds: string[];
      projectRole?: "project_manager" | "member" | "client_contact" | "viewer";
    },
  ) {
    return fetchWithAuth(`/admin/people/${userId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
