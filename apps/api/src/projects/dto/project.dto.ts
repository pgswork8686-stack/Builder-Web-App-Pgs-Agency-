import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'draft',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]);
export const ProjectPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'urgent',
]);
export const ProjectMemberRoleSchema = z.enum([
  'project_manager',
  'member',
  'client_contact',
  'viewer',
]);
export const ProjectServiceStatusSchema = z.enum([
  'planned',
  'active',
  'paused',
  'completed',
  'cancelled',
]);

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Ngày không hợp lệ.');

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const validateDateRange = (
  value: { startDate?: string | null; dueDate?: string | null },
  context: z.RefinementCtx,
) => {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'INVALID_PROJECT_DATE_RANGE',
      path: ['dueDate'],
    });
  }
};

export const CreateProjectSchema = z
  .object({
    projectCode: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((value) => value.toUpperCase()),
    clientCompanyId: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    description: nullableText(5000),
    status: ProjectStatusSchema.default('draft'),
    priority: ProjectPrioritySchema.default('medium'),
    projectManagerUserId: z.string().uuid().nullable().optional(),
    startDate: DateSchema.nullable().optional(),
    dueDate: DateSchema.nullable().optional(),
  })
  .strict()
  .superRefine(validateDateRange);

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    clientCompanyId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(200).optional(),
    description: nullableText(5000),
    status: ProjectStatusSchema.optional(),
    priority: ProjectPrioritySchema.optional(),
    projectManagerUserId: z.string().uuid().nullable().optional(),
    startDate: DateSchema.nullable().optional(),
    dueDate: DateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  })
  .superRefine(validateDateRange);

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

const PageSchema = z.coerce.number().int().min(1).default(1);
const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

export const ProjectListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  clientCompanyId: z.string().uuid().optional(),
  status: ProjectStatusSchema.optional(),
  priority: ProjectPrioritySchema.optional(),
  projectManagerUserId: z.string().uuid().optional(),
  page: PageSchema,
  pageSize: PageSizeSchema,
});

export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

export const CreateProjectMembershipSchema = z
  .object({
    userId: z.string().uuid(),
    projectRole: ProjectMemberRoleSchema.default('member'),
  })
  .strict();

export type CreateProjectMembershipDto = z.infer<
  typeof CreateProjectMembershipSchema
>;

export const UpdateProjectMembershipSchema = z
  .object({ projectRole: ProjectMemberRoleSchema.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type UpdateProjectMembershipDto = z.infer<
  typeof UpdateProjectMembershipSchema
>;

export const CreateProjectServiceSchema = z
  .object({
    serviceId: z.string().uuid(),
    status: ProjectServiceStatusSchema.default('planned'),
    notes: nullableText(5000),
    startedAt: z.string().datetime({ offset: true }).nullable().optional(),
    endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type CreateProjectServiceDto = z.infer<
  typeof CreateProjectServiceSchema
>;

export const UpdateProjectServiceSchema = z
  .object({
    status: ProjectServiceStatusSchema.optional(),
    notes: nullableText(5000),
    startedAt: z.string().datetime({ offset: true }).nullable().optional(),
    endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type UpdateProjectServiceDto = z.infer<
  typeof UpdateProjectServiceSchema
>;
