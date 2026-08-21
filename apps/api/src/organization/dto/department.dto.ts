import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
  code: z
    .string()
    .min(2, 'Mã phòng ban phải từ 2 ký tự')
    .max(30, 'Mã phòng ban tối đa 30 ký tự')
    .toUpperCase(),
  name: z
    .string()
    .min(2, 'Tên phòng ban phải từ 2 ký tự')
    .max(120, 'Tên phòng ban tối đa 120 ký tự'),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  headUserId: z
    .string()
    .uuid('Trưởng phòng không hợp lệ')
    .nullable()
    .optional(),
});

export type CreateDepartmentDto = z.infer<typeof CreateDepartmentSchema>;

export const UpdateDepartmentSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên phòng ban phải từ 2 ký tự')
    .max(120, 'Tên phòng ban tối đa 120 ký tự')
    .optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  headUserId: z
    .string()
    .uuid('Trưởng phòng không hợp lệ')
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDepartmentDto = z.infer<typeof UpdateDepartmentSchema>;
