import { request } from "./client";

export interface ChatProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface ChatProject {
  id: string;
  project_code?: string | null;
  name?: string | null;
}

export interface ChatConversation {
  id: string;
  type: "direct" | "project";
  title: string | null;
  projectId: string | null;
  project: ChatProject | null;
  directUserLow: string | null;
  directUserHigh: string | null;
  lastMessageAt: string | null;
  readAt: string | null;
  hasUnread: boolean;
  currentUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  sender: ChatProfile | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedChatConversations {
  items: ChatConversation[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function paramsFrom(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const chatApi = {
  listConversations(
    query: {
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    return request<PaginatedChatConversations>(
      `/chat/conversations?${paramsFrom(query)}`,
    );
  },

  unreadCount() {
    return request<{ unreadCount: number }>("/chat/unread-count");
  },

  createDirect(peerUserId: string) {
    return request<ChatConversation>("/chat/direct", {
      method: "POST",
      body: JSON.stringify({ peerUserId }),
    });
  },

  getProjectConversation(projectId: string) {
    return request<ChatConversation>(`/chat/projects/${projectId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  getConversation(conversationId: string) {
    return request<ChatConversation>(`/chat/conversations/${conversationId}`);
  },

  listMessages(
    conversationId: string,
    query: {
      limit?: number;
      before?: string;
    } = {},
  ) {
    return request<{ items: ChatMessage[]; nextBefore: string | null }>(
      `/chat/conversations/${conversationId}/messages?${paramsFrom(query)}`,
    );
  },

  sendMessage(conversationId: string, content: string) {
    return request<ChatMessage>(
      `/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
  },

  markRead(conversationId: string) {
    return request<{ conversationId: string; readAt: string | null }>(
      `/chat/conversations/${conversationId}/read`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  },
};
