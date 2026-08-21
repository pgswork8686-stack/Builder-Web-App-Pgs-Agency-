import { request } from "./client";

export interface UserPayload {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export type AppRole = NonNullable<AccountPayload["role"]>;

export interface AccountPayload {
  status: "pending" | "active" | "rejected";
  role: "admin" | "team_leader" | "employee" | "accountant" | "client" | null;
  approvedAt: string | null;
  rejectionReason: string | null;
}

export interface AuthMeResponse {
  user: UserPayload;
  account: AccountPayload;
  canBootstrapAdmin: boolean;
}

export async function getMe(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/auth/me");
}

export async function bootstrapAdmin(): Promise<any> {
  return request<any>("/auth/bootstrap-admin", {
    method: "POST",
  });
}
