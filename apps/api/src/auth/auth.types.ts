import { Request } from 'express';

export type AppRole =
  'admin' | 'team_leader' | 'employee' | 'accountant' | 'client';

export type AccountStatus = 'pending' | 'active' | 'rejected';

export interface RequestUser {
  authUserId: string;
  profileId: string;
  email: string | null;
  phone: string | null;
  accountStatus: AccountStatus;
  role: AppRole | null;
  fullName: string | null;
  avatarUrl: string | null;
  approvedAt: string | null;
  rejectionReason?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
