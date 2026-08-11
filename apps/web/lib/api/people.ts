import { createBrowserClient } from "@supabase/ssr";

const getSessionToken = async () => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = await getSessionToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  } as Record<string, string>;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1${url}`,
    {
      ...options,
      headers,
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Yêu cầu API thất bại");
  }

  return res.json();
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
};
