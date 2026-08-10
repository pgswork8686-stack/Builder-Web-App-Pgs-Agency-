import { Request } from 'express';

export type AppRole =
  'admin' | 'team_leader' | 'employee' | 'accountant' | 'client';

export type AccountStatus = 'pending' | 'active' | 'rejected';

export interface RequestUser {
  id: string;
  email: string;
  role: AppRole | null;
  account_status: AccountStatus;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
