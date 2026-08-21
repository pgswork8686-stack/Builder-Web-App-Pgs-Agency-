import { request } from "./client";

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  preferences: Record<string, unknown>;
  updatedAt: string | null;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function paramsFrom(
  values: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const notificationsApi = {
  list(
    query: {
      page?: number;
      pageSize?: number;
      unreadOnly?: boolean;
    } = {},
  ) {
    return request<PaginatedNotifications>(
      `/notifications?${paramsFrom(query)}`,
    );
  },

  unreadCount() {
    return request<{ unreadCount: number }>("/notifications/unread-count");
  },

  markRead(notificationId: string) {
    return request<NotificationItem>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  },

  markAllRead() {
    return request<{ updated: number }>("/notifications/read-all", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  getPreferences() {
    return request<NotificationPreferences>("/notifications/preferences");
  },

  updatePreferences(
    payload: Partial<{
      inAppEnabled: boolean;
      emailEnabled: boolean;
    }>,
  ) {
    return request<NotificationPreferences>("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  broadcast(data: {
    title: string;
    message: string;
    type?: string;
    actionUrl?: string | null;
  }) {
    return request<{
      success: boolean;
      count: number;
      delivered: number;
      message: string;
    }>("/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
