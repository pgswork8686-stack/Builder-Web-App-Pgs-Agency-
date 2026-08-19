import { request } from "./client";

export interface SystemSetting {
  key: string;
  category: "general" | "attendance" | "finance" | "security" | "notifications";
  value: Record<string, any>;
  description?: string | null;
  updated_by_user_id?: string | null;
  updated_by_user_code?: string | null;
  updated_at: string;
  updated_by?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
}

export async function fetchAllSettings(): Promise<SystemSetting[]> {
  return request<SystemSetting[]>("/admin/settings");
}

export async function updateSingleSetting(data: {
  key: string;
  category: string;
  value: Record<string, any>;
  description?: string | null;
}): Promise<SystemSetting> {
  return request<SystemSetting>("/admin/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function bulkUpdateSettings(
  settings: Array<{
    key: string;
    category: string;
    value: Record<string, any>;
    description?: string | null;
  }>,
): Promise<SystemSetting[]> {
  return request<SystemSetting[]>("/admin/settings/bulk", {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  });
}
