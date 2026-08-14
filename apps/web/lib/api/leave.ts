import { request } from "./client";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_balance: boolean;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  adjusted_days: number;
  leave_type?: LeaveType;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewer_user_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  leave_type?: LeaveType;
  employee?: {
    id: string;
    fullName: string;
    email: string;
    teamId: string | null;
    departmentId: string | null;
  };
}

export interface LeaveQuery {
  status?: string;
  leaveTypeId?: string;
  userId?: string;
  teamId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const leaveApi = {
  getLeaveTypes: (): Promise<LeaveType[]> => {
    return request("/leave/types");
  },

  getMyRequests: (
    query: LeaveQuery = {},
  ): Promise<{
    items: LeaveRequest[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.status) params.append("status", query.status);
    if (query.leaveTypeId) params.append("leaveTypeId", query.leaveTypeId);
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());

    return request(`/leave/me/requests?${params.toString()}`);
  },

  getMyBalances: (): Promise<LeaveBalance[]> => {
    return request("/leave/me/balances");
  },

  createRequest: (payload: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string | null;
  }): Promise<LeaveRequest> => {
    return request("/leave/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getDirectory: (
    query: LeaveQuery = {},
  ): Promise<{
    items: LeaveRequest[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (query.status) params.append("status", query.status);
    if (query.leaveTypeId) params.append("leaveTypeId", query.leaveTypeId);
    if (query.userId) params.append("userId", query.userId);
    if (query.teamId) params.append("teamId", query.teamId);
    if (query.page) params.append("page", query.page.toString());
    if (query.pageSize) params.append("pageSize", query.pageSize.toString());

    return request(`/leave/directory?${params.toString()}`);
  },

  reviewRequest: (
    requestId: string,
    payload: { action: "approved" | "rejected"; reviewNote?: string | null },
  ): Promise<LeaveRequest> => {
    return request(`/leave/requests/${requestId}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cancelRequest: (requestId: string): Promise<LeaveRequest> => {
    return request(`/leave/requests/${requestId}/cancel`, {
      method: "POST",
    });
  },

  adjustBalance: (
    balanceId: string,
    payload: { deltaDays: number; reason: string },
  ): Promise<any> => {
    return request(`/leave/balances/${balanceId}/adjust`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getCalendar: (from: string, to: string): Promise<any[]> => {
    return request(`/leave/calendar?from=${from}&to=${to}`);
  },
};
