import { AppRole } from '../../auth/auth.types';
import { z } from 'zod';

export const ApproveUserSchema = z.object({
  role: z.enum(['team_leader', 'employee', 'accountant', 'client'], {
    errorMap: () => ({ message: 'Invalid role. Must be team_leader, employee, accountant, or client.' }),
  }),
});

export class ApproveUserDto {
  role!: AppRole;
}

