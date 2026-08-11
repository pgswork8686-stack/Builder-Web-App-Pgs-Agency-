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

export const clientsApi = {
  // Client own scope
  async getMyCompanies() {
    return fetchWithAuth("/client/me/companies");
  },

  // Admin company CRUD
  async getClientCompanies(filters?: {
    q?: string;
    status?: "active" | "inactive";
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.q) params.append("q", filters.q);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.pageSize) params.append("pageSize", String(filters.pageSize));

    return fetchWithAuth(`/admin/clients?${params.toString()}`);
  },

  async getClientCompanyById(clientId: string) {
    return fetchWithAuth(`/admin/clients/${clientId}`);
  },

  async createClientCompany(data: {
    code: string;
    name: string;
    taxCode?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    status: "active" | "inactive";
    notes?: string | null;
  }) {
    return fetchWithAuth("/admin/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateClientCompany(
    clientId: string,
    data: {
      name?: string;
      taxCode?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      address?: string | null;
      status?: "active" | "inactive";
      notes?: string | null;
    },
  ) {
    return fetchWithAuth(`/admin/clients/${clientId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Memberships
  async getMemberships(clientId: string) {
    return fetchWithAuth(`/admin/clients/${clientId}/members`);
  },

  async createMembership(
    clientId: string,
    data: {
      userId: string;
      title?: string | null;
      isPrimary: boolean;
    },
  ) {
    return fetchWithAuth(`/admin/clients/${clientId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMembership(
    clientId: string,
    membershipId: string,
    data: {
      title?: string | null;
      isPrimary?: boolean;
    },
  ) {
    return fetchWithAuth(`/admin/clients/${clientId}/members/${membershipId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteMembership(clientId: string, membershipId: string) {
    return fetchWithAuth(`/admin/clients/${clientId}/members/${membershipId}`, {
      method: "DELETE",
    });
  },
};
