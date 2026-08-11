import { request } from './client';

export interface PendingUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  accountStatus: 'pending' | 'active' | 'rejected';
  role: 'admin' | 'team_leader' | 'employee' | 'accountant' | 'client' | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingUsersResponse {
  items: PendingUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export async function getPendingUsers(page: number = 1, pageSize: number = 20): Promise<PendingUsersResponse> {
  return request<PendingUsersResponse>(`/admin/users/pending?page=${page}&pageSize=${pageSize}`);
}

export async function approveUser(userId: string, role: string): Promise<any> {
  return request<any>(`/admin/users/${userId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function rejectUser(userId: string, reason: string): Promise<any> {
  return request<any>(`/admin/users/${userId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
