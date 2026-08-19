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

export const UpdatePersonFullSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').optional(),
  phone: z.string().trim().optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
  role: z
    .enum(['admin', 'team_leader', 'employee', 'accountant', 'client'])
    .optional(),
  accountStatus: z
    .enum(['pending', 'active', 'suspended', 'terminated', 'rejected'])
    .optional(),
  employeeCode: z.string().trim().min(2).max(30).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  employmentStatus: z
    .enum(['probation', 'active', 'on_leave', 'terminated'])
    .optional(),
  joinedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export type UpdatePersonFullDto = z.infer<typeof UpdatePersonFullSchema>;

export const AssignUserProjectsSchema = z.object({
  projectIds: z.array(z.string().uuid('Project ID không hợp lệ')),
  projectRole: z
    .enum(['project_manager', 'member', 'client_contact', 'viewer'])
    .default('member'),
});

export type AssignUserProjectsDto = z.infer<typeof AssignUserProjectsSchema>;
