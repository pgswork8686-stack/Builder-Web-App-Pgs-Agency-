import { request } from "./client";

export interface SupportTicket {
  id: string;
  ticket_code?: string;
  client_company_id: string;
  client_company_code?: string;
  project_id?: string | null;
  project_code?: string | null;
  creator_user_id: string;
  creator_user_code?: string | null;
  assignee_user_id?: string | null;
  assignee_user_code?: string | null;
  title: string;
  description: string;
  category:
    "technical" | "billing" | "project_scope" | "bug_report" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_client" | "resolved" | "closed";
  resolved_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  client_company?: {
    id: string;
    name: string;
    client_company_code?: string;
  };
  project?: {
    id: string;
    name: string;
    project_code?: string;
  };
  creator?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
  assignee?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
  messages?: SupportTicketMessage[];
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  ticket_code?: string;
  sender_user_id: string;
  sender_user_code?: string;
  content: string;
  is_internal_note: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
    role: string;
    avatar_url?: string | null;
  };
}

export interface SupportTicketsListResponse {
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchSupportTickets(params?: {
  status?: string;
  category?: string;
  priority?: string;
  clientCompanyId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<SupportTicketsListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.category) query.append("category", params.category);
  if (params?.priority) query.append("priority", params.priority);
  if (params?.clientCompanyId)
    query.append("clientCompanyId", params.clientCompanyId);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const qs = query.toString();
  return request<SupportTicketsListResponse>(
    `/support/tickets${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchSupportTicketById(
  id: string,
): Promise<SupportTicket> {
  return request<SupportTicket>(`/support/tickets/${id}`);
}

export async function createSupportTicket(data: {
  clientCompanyId?: string | null;
  projectId?: string | null;
  title: string;
  description: string;
  category?: string;
  priority?: string;
}): Promise<SupportTicket> {
  return request<SupportTicket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function sendTicketMessage(
  ticketId: string,
  data: { content: string; isInternalNote?: boolean },
): Promise<SupportTicketMessage> {
  return request<SupportTicketMessage>(
    `/support/tickets/${ticketId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function updateTicketStatus(
  ticketId: string,
  data: { status: string; assigneeUserId?: string | null },
): Promise<SupportTicket> {
  return request<SupportTicket>(`/support/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
