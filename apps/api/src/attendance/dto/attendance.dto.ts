import { z } from 'zod';

export const CheckInSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    accuracyMeters: z.number().nonnegative().optional().nullable(),
    photoUploadSessionId: z
      .string()
      .uuid('photoUploadSessionId phải là định dạng UUID hợp lệ.')
      .optional()
      .nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type CheckInDto = z.infer<typeof CheckInSchema>;

export const CheckOutSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    accuracyMeters: z.number().nonnegative().optional().nullable(),
    photoUploadSessionId: z
      .string()
      .uuid('photoUploadSessionId phải là định dạng UUID hợp lệ.')
      .optional()
      .nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type CheckOutDto = z.infer<typeof CheckOutSchema>;

export const AttendanceQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD.')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD.')
    .optional(),
  userId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z
    .enum([
      'present',
      'late',
      'early_leave',
      'late_and_early_leave',
      'incomplete',
      'absent',
      'on_leave',
    ])
    .optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AttendanceQuery = z.infer<typeof AttendanceQuerySchema>;

export const AttendanceAdjustmentSchema = z
  .object({
    checkInAt: z.string().datetime().optional().nullable(),
    checkOutAt: z.string().datetime().optional().nullable(),
    status: z
      .enum([
        'present',
        'late',
        'early_leave',
        'late_and_early_leave',
        'incomplete',
        'absent',
        'on_leave',
      ])
      .optional(),
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();

export type AttendanceAdjustmentDto = z.infer<
  typeof AttendanceAdjustmentSchema
>;
