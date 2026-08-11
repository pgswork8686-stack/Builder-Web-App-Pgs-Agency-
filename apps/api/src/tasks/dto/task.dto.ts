import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
]);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

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

const validateDateRange = (
  value: { startDate?: string | null; dueDate?: string | null },
  context: z.RefinementCtx,
) => {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'INVALID_TASK_DATE_RANGE',
      path: ['dueDate'],
    });
  }
};

export const CreateTaskSchema = z
  .object({
    parentTaskId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(10000).nullable().optional(),
    status: TaskStatusSchema.default('todo'),
    priority: TaskPrioritySchema.default('medium'),
    assigneeUserId: z.string().uuid().nullable().optional(),
    startDate: DateSchema.nullable().optional(),
    dueDate: DateSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict()
  .superRefine(validateDateRange);

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .object({
    parentTaskId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    assigneeUserId: z.string().uuid().nullable().optional(),
    startDate: DateSchema.nullable().optional(),
    dueDate: DateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  })
  .superRefine(validateDateRange);

export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;

export const TaskListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeUserId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
