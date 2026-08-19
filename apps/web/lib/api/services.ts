import type { Paginated } from "./projects";
import { request } from "./client";

export interface ServiceCategory {
  id: string;
  serviceCategoryCode: string; // NHDV_01...
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  sort_order?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const servicesApi = {
  // Categories
  listCategories(filters: { q?: string; isActive?: boolean } = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.isActive !== undefined)
      params.set("isActive", String(filters.isActive));
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
    isActive?: boolean;
  }) {
    return request<ServiceCategory>("/admin/service-categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateCategory(
    id: string,
    data: Partial<{
      code: string;
      name: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }>,
  ) {
    return request<ServiceCategory>(`/admin/service-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
      isActive?: boolean;
    },
  ) {
    return request<ServiceDeliveryItem>(
      `/admin/services/${serviceId}/delivery-items`,
      {
        method: "POST",
        body: JSON.stringify(data),
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
      isActive?: boolean;
    }>,
  ) {
    return request<ServiceDeliveryItem>(
      `/admin/services/${serviceId}/delivery-items/${itemId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
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
