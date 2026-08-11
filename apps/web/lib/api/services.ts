import type { Paginated } from "./projects";
import { request } from "./client";

export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const servicesApi = {
  list(
    filters: {
      q?: string;
      active?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.active !== undefined)
      params.set("active", String(filters.active));
    params.set("page", String(filters.page ?? 1));
    params.set("pageSize", String(filters.pageSize ?? 20));
    return request<Paginated<ServiceCatalogItem>>(
      `/admin/services?${params.toString()}`,
    );
  },
  get(serviceId: string) {
    return request<ServiceCatalogItem>(`/admin/services/${serviceId}`);
  },
  create(data: {
    code: string;
    name: string;
    description?: string | null;
    active?: boolean;
  }) {
    return request<ServiceCatalogItem>("/admin/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  update(
    serviceId: string,
    data: Partial<
      Pick<ServiceCatalogItem, "code" | "name" | "description" | "active">
    >,
  ) {
    return request<ServiceCatalogItem>(`/admin/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
