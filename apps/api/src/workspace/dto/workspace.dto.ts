import { z } from 'zod';
import { TaskPrioritySchema } from '../../tasks/dto/task.dto';

export const BoardTaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'review',
  'done',
]);

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().substring(0, 10) === value
    );
  }, 'Ngày không hợp lệ.');

const PageSchema = z.coerce.number().int().min(1).default(1);
const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

export const BoardQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  assigneeUserId: z.string().uuid().optional(),
  priority: TaskPrioritySchema.optional(),
  status: BoardTaskStatusSchema.optional(),
});
export type BoardQuery = z.infer<typeof BoardQuerySchema>;

export const MoveTaskSchema = z
  .object({
    status: BoardTaskStatusSchema,
    beforeTaskId: z.string().uuid().nullable().optional(),
    afterTaskId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.beforeTaskId ||
      !value.afterTaskId ||
      value.beforeTaskId !== value.afterTaskId,
    { message: 'KANBAN_TARGET_INVALID' },
  );
export type MoveTaskDto = z.infer<typeof MoveTaskSchema>;

export const CalendarQuerySchema = z
  .object({ from: DateSchema, to: DateSchema })
  .strict()
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CALENDAR_INVALID_RANGE',
        path: ['to'],
      });
      return;
    }
    const from = new Date(`${value.from}T00:00:00.000Z`);
    const to = new Date(`${value.to}T00:00:00.000Z`);
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > 93) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CALENDAR_RANGE_TOO_LARGE',
        path: ['to'],
      });
    }
  });
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CommentPaginationSchema = z.object({
  page: PageSchema,
  pageSize: PageSizeSchema,
});
export type CommentPagination = z.infer<typeof CommentPaginationSchema>;

export const CreateCommentSchema = z
  .object({ content: z.string().trim().min(1).max(10000) })
  .strict();
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z
  .object({ content: z.string().trim().min(1).max(10000).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });
export type UpdateCommentDto = z.infer<typeof UpdateCommentSchema>;

export const AllowedFileMimeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
export type AllowedFileMime = z.infer<typeof AllowedFileMimeSchema>;

export const FileListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  taskId: z.string().uuid().optional(),
  mimeType: z.string().trim().max(200).optional(),
  page: PageSchema,
  pageSize: PageSizeSchema,
});
export type FileListQuery = z.infer<typeof FileListQuerySchema>;

export const UploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(200),
    sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type UploadRequestDto = z.infer<typeof UploadRequestSchema>;

export const FinalizeFileSchema = z
  .object({ uploadSessionId: z.string().uuid() })
  .strict();
export type FinalizeFileDto = z.infer<typeof FinalizeFileSchema>;
