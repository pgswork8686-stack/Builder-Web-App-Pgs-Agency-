import { request } from "./client";

export interface ClientCompany {
  id: string;
  code: string;
  clientCode?: string;
  name: string;
  taxCode?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  status: "active" | "inactive";
  isActive?: boolean;
  notes?: string | null;
  contactPerson?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  return request(url, options);
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
