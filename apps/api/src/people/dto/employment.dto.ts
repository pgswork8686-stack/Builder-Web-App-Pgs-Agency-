import { z } from 'zod';

export const CreateEmploymentSchema = z.object({
  employeeCode: z
    .string()
    .min(2, 'Mã nhân viên phải từ 2 ký tự')
    .max(30, 'Mã nhân viên tối đa 30 ký tự')
    .toUpperCase(),
  departmentId: z
    .string()
    .uuid('departmentId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  teamId: z
    .string()
    .uuid('teamId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  jobTitle: z.string().optional().nullable(),
  reportsToUserId: z
    .string()
    .uuid('reportsToUserId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  employmentStatus: z
    .enum(['probation', 'active', 'on_leave', 'terminated'])
    .default('active'),
  joinedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'joinedDate phải định dạng YYYY-MM-DD')
    .optional()
    .nullable(),
});

export type CreateEmploymentDto = z.infer<typeof CreateEmploymentSchema>;

export const UpdateEmploymentSchema = z.object({
  departmentId: z
    .string()
    .uuid('departmentId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  teamId: z
    .string()
    .uuid('teamId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  jobTitle: z.string().optional().nullable(),
  reportsToUserId: z
    .string()
    .uuid('reportsToUserId phải là định dạng UUID hợp lệ')
    .optional()
    .nullable(),
  employmentStatus: z
    .enum(['probation', 'active', 'on_leave', 'terminated'])
    .optional(),
  joinedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'joinedDate phải định dạng YYYY-MM-DD')
    .optional()
    .nullable(),
  leftDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'leftDate phải định dạng YYYY-MM-DD')
    .optional()
    .nullable(),
});

export type UpdateEmploymentDto = z.infer<typeof UpdateEmploymentSchema>;
