import { z } from 'zod';

export const LeaveRequestCreateSchema = z
  .object({
    leaveTypeId: z.string().uuid('leaveTypeId phải là định dạng UUID hợp lệ.'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD.'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD.'),
    reason: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type LeaveRequestCreateDto = z.infer<typeof LeaveRequestCreateSchema>;

export const LeaveReviewSchema = z
  .object({
    action: z.enum(['approved', 'rejected']),
    reviewNote: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type LeaveReviewDto = z.infer<typeof LeaveReviewSchema>;

export const LeaveBalanceAdjustmentSchema = z
  .object({
    deltaDays: z.number().min(-100).max(100),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();

export type LeaveBalanceAdjustmentDto = z.infer<
  typeof LeaveBalanceAdjustmentSchema
>;

export const LeaveQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  leaveTypeId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type LeaveQuery = z.infer<typeof LeaveQuerySchema>;
