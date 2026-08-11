import { z } from 'zod';

export const CreateTeamSchema = z.object({
  departmentId: z.string().uuid('departmentId phải là định dạng UUID hợp lệ'),
  code: z
    .string()
    .min(2, 'Mã đội nhóm phải từ 2 ký tự')
    .max(30, 'Mã đội nhóm tối đa 30 ký tự')
    .toUpperCase(),
  name: z
    .string()
    .min(2, 'Tên đội nhóm phải từ 2 ký tự')
    .max(120, 'Tên đội nhóm tối đa 120 ký tự'),
  leaderUserId: z
    .string()
    .uuid('leaderUserId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  description: z.string().optional().nullable(),
});

export type CreateTeamDto = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên đội nhóm phải từ 2 ký tự')
    .max(120, 'Tên đội nhóm tối đa 120 ký tự')
    .optional(),
  leaderUserId: z
    .string()
    .uuid('leaderUserId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateTeamDto = z.infer<typeof UpdateTeamSchema>;
