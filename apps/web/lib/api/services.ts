import type { Paginated } from "./projects";
import { request } from "./client";

export interface ServiceCategory {
  id: string;
  serviceCategoryCode: string; // NHDV_01...
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
  isActive?: boolean;
  servicesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDeliveryItem {
  id: string;
  delivery_item_code: string; // HMDV_01...
  service_id: string;
  service_code?: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_required: boolean;
  isRequired?: boolean;
  active: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}


export interface ServiceResponsibilityRef {
  id: string;
  code?: string | null;
  departmentCode?: string | null;
}

export interface ServiceResponsibilities {
  serviceId: string;
  serviceCode?: string | null;
  serviceName: string;
  ownerDepartment: ServiceResponsibilityRef | null;
  ownerTeam: ServiceResponsibilityRef | null;
  collaboratingDepartments: ServiceResponsibilityRef[];
  collaboratingTeams: ServiceResponsibilityRef[];
}

export interface ServiceResponsibilityAssignment {
  id: string;
  department_id?: string;
  department_code?: string | null;
  team_id?: string;
  team_code?: string | null;
  responsibility_role: "owner" | "collaborator";
}

export interface ServiceCatalogItem {
  id: string;
  service_code?: string; // DV_01...
  serviceCode?: string;
  code: string;
  name: string;
  description?: string | null;
  service_category_id?: string | null;
  service_category_code?: string | null;
  category?: {
    id: string;
    code: string;
    service_category_code?: string;
    name: string;
  } | null;
  delivery_items?: ServiceDeliveryItem[];
  department_assignments?: ServiceResponsibilityAssignment[];
  team_assignments?: ServiceResponsibilityAssignment[];
  sort_order?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const servicesApi = {
  // Categories
  listCategories(
    filters: { q?: string; active?: boolean; isActive?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    const activeVal =
      filters.active !== undefined ? filters.active : filters.isActive;
    if (activeVal !== undefined) params.set("active", String(activeVal));
    return request<ServiceCategory[]>(
      `/admin/service-categories?${params.toString()}`,
    );
  },

  getCategory(id: string) {
    return request<ServiceCategory>(`/admin/service-categories/${id}`);
  },

  createCategory(data: {
    code: string;
    name: string;
    description?: string | null;
    sortOrder?: number;
    active?: boolean;
    isActive?: boolean;
  }) {
    return request<ServiceCategory>("/admin/service-categories", {
      method: "POST",
      body: JSON.stringify({
        code: data.code,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder,
        active: data.active !== undefined ? data.active : data.isActive,
      }),
    });
  },

  updateCategory(
    id: string,
    data: Partial<{
      code: string;
      name: string;
      description?: string | null;
      sortOrder?: number;
      isRequired?: boolean;
      active?: boolean;
      isActive?: boolean;
    }>,
  ) {
    const payload: Record<string, unknown> = {};
    if (data.code !== undefined) payload.code = data.code;
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.isRequired !== undefined) payload.isRequired = data.isRequired;
    if (data.active !== undefined) payload.active = data.active;
    else if (data.isActive !== undefined) payload.active = data.isActive;

    return request<ServiceCategory>(`/admin/service-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deactivateCategory(id: string) {
    return request<{ success: boolean }>(`/admin/service-categories/${id}`, {
      method: "DELETE",
    });
  },

  // Services
  list(
    filters: {
      q?: string;
      categoryId?: string;
      active?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.active !== undefined)
      params.set("active", String(filters.active));
    params.set("page", String(filters.page ?? 1));
    params.set("pageSize", String(filters.pageSize ?? 50));
    return request<Paginated<ServiceCatalogItem>>(
      `/admin/services?${params.toString()}`,
    );
  },

  get(serviceId: string) {
    return request<ServiceCatalogItem>(`/admin/services/${serviceId}`);
  },

  create(data: {
    code?: string;
    name: string;
    description?: string | null;
    categoryId?: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    return request<ServiceCatalogItem>("/admin/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update(
    serviceId: string,
    data: Partial<{
      code: string;
      name: string;
      description?: string | null;
      categoryId?: string | null;
      sortOrder?: number;
      active?: boolean;
    }>,
  ) {
    return request<ServiceCatalogItem>(`/admin/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deactivate(serviceId: string) {
    return request<ServiceCatalogItem>(`/admin/services/${serviceId}`, {
      method: "DELETE",
    });
  },

  getResponsibilities(serviceId: string) {
    return request<ServiceResponsibilities>(
      `/admin/services/${serviceId}/responsibilities`,
    );
  },

  updateResponsibilities(
    serviceId: string,
    data: {
      ownerDepartmentId: string;
      ownerTeamId?: string | null;
      collaboratorDepartmentIds?: string[];
      collaboratorTeamIds?: string[];
    },
  ) {
    return request<ServiceResponsibilities>(
      `/admin/services/${serviceId}/responsibilities`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  },

  // Delivery Items (Standard Templates)
  listDeliveryItems(serviceId: string) {
    return request<ServiceDeliveryItem[]>(
      `/admin/services/${serviceId}/delivery-items`,
    );
  },

  createDeliveryItem(
    serviceId: string,
    data: {
      name: string;
      description?: string | null;
      sortOrder?: number;
      isRequired?: boolean;
      active?: boolean;
      isActive?: boolean;
    },
  ) {
    return request<ServiceDeliveryItem>(
      `/admin/services/${serviceId}/delivery-items`,
      {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder,
          isRequired: data.isRequired,
          active: data.active !== undefined ? data.active : data.isActive,
        }),
      },
    );
  },

  updateDeliveryItem(
    serviceId: string,
    itemId: string,
    data: Partial<{
      name: string;
      description?: string | null;
      sortOrder?: number;
      isRequired?: boolean;
      active?: boolean;
      isActive?: boolean;
    }>,
  ) {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder;
    if (data.isRequired !== undefined) payload.isRequired = data.isRequired;
    if (data.active !== undefined) payload.active = data.active;
    else if (data.isActive !== undefined) payload.active = data.isActive;

    return request<ServiceDeliveryItem>(
      `/admin/services/${serviceId}/delivery-items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  deleteDeliveryItem(serviceId: string, itemId: string) {
    return request<{ success: boolean }>(
      `/admin/services/${serviceId}/delivery-items/${itemId}`,
      {
        method: "DELETE",
      },
    );
  },
};
