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

export const AttendanceSignedUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    fileSize: z
      .number()
      .int()
      .min(1)
      .max(5 * 1024 * 1024),
  })
  .strict();

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

const TimeOfDaySchema = z
  .string()
  .trim()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/,
    'Giờ phải theo định dạng HH:MM hoặc HH:MM:SS.',
  )
  .transform((value) => (value.length === 5 ? `${value}:00` : value));

const TimezoneSchema = z
  .string()
  .trim()
  .min(1, 'Múi giờ không được để trống.')
  .max(100, 'Múi giờ không hợp lệ.')
  .refine(
    (timezone) => {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Múi giờ phải là IANA timezone hợp lệ.' },
  );

function timeOfDayToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * PATCH payload for the canonical attendance_settings singleton.
 *
 * Field names are API camelCase; AttendanceService maps them only to the
 * corresponding production table columns. Nullable values intentionally stay
 * nullable because an unset HR policy must not be replaced with an invented
 * default.
 */
export const UpdateAttendanceSettingsSchema = z
  .object({
    timezone: TimezoneSchema.optional(),
    workdayStartTime: TimeOfDaySchema.nullable().optional(),
    workdayEndTime: TimeOfDaySchema.nullable().optional(),
    lateGraceMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .nullable()
      .optional(),
    earlyLeaveGraceMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .nullable()
      .optional(),
    locationRequired: z.boolean().optional(),
    photoRequired: z.boolean().optional(),
    locationRadiusMeters: z
      .number()
      .finite()
      .positive()
      .max(100_000)
      .nullable()
      .optional(),
    officeLatitude: z.number().finite().min(-90).max(90).nullable().optional(),
    officeLongitude: z
      .number()
      .finite()
      .min(-180)
      .max(180)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const start = value.workdayStartTime;
    const end = value.workdayEndTime;
    if (start !== undefined && end !== undefined) {
      if ((start === null) !== (end === null)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workdayEndTime'],
          message:
            'Giờ bắt đầu và kết thúc phải cùng được cấu hình hoặc cùng để trống.',
        });
      } else if (
        start !== null &&
        end !== null &&
        timeOfDayToMinutes(end) <= timeOfDayToMinutes(start)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workdayEndTime'],
          message: 'Giờ kết thúc phải sau giờ bắt đầu.',
        });
      }
    }

    const hasBothCoordinates =
      value.officeLatitude !== undefined && value.officeLongitude !== undefined;
    if (
      hasBothCoordinates &&
      (value.officeLatitude === null) !== (value.officeLongitude === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['officeLongitude'],
        message:
          'Vĩ độ và kinh độ văn phòng phải cùng được cấu hình hoặc cùng để trống.',
      });
    }

    if (!Object.values(value).some((field) => field !== undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cần cung cấp ít nhất một trường cấu hình để cập nhật.',
      });
    }
  });

export type UpdateAttendanceSettingsDto = z.infer<
  typeof UpdateAttendanceSettingsSchema
>;
