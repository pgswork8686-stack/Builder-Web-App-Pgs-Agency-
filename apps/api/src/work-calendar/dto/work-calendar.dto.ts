import { z } from 'zod';

export const WorkCalendarRangeQuerySchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be in YYYY-MM-DD format'),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be in YYYY-MM-DD format'),
  })
  .refine((data) => data.from <= data.to, {
    message: 'from date must be less than or equal to to date',
    path: ['to'],
  });

export type WorkCalendarRangeQueryDto = z.infer<
  typeof WorkCalendarRangeQuerySchema
>;

export const UpdateWorkCalendarSettingsSchema = z
  .object({
    timezone: z.string().min(1).optional(),
    weekdayWorkingDays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .optional(),
    alternateSaturdayEnabled: z.boolean().optional(),
    alternateSaturdayAnchorDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    alternateSaturdayAnchorIsWorking: z.boolean().optional(),
    applyGovernmentMakeupDays: z.boolean().optional(),
    holidayCountryCode: z.string().min(2).max(10).optional(),
    holidayProvider: z.string().nullable().optional(),
    autoHolidaySyncEnabled: z.boolean().optional(),
  })
  .strict();

export type UpdateWorkCalendarSettingsDto = z.infer<
  typeof UpdateWorkCalendarSettingsSchema
>;

export const WorkCalendarEventTypeEnum = z.enum([
  'public_holiday',
  'company_holiday',
  'makeup_workday',
  'special_workday',
]);

export type WorkCalendarEventType = z.infer<typeof WorkCalendarEventTypeEnum>;

export const CreateWorkCalendarEventSchema = z
  .object({
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be in YYYY-MM-DD format'),
    eventType: WorkCalendarEventTypeEnum,
    title: z.string().trim().min(1, 'title is required').max(200),
    isWorkingDay: z.boolean(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export type CreateWorkCalendarEventDto = z.infer<
  typeof CreateWorkCalendarEventSchema
>;

export const UpdateWorkCalendarEventSchema = z
  .object({
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be in YYYY-MM-DD format')
      .optional(),
    eventType: WorkCalendarEventTypeEnum.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    isWorkingDay: z.boolean().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(['active', 'inactive', 'cancelled']).optional(),
  })
  .strict();

export type UpdateWorkCalendarEventDto = z.infer<
  typeof UpdateWorkCalendarEventSchema
>;

export const SyncHolidaysDtoSchema = z
  .object({
    year: z
      .number()
      .int()
      .min(2000)
      .max(2100)
      .default(() => new Date().getFullYear()),
  })
  .strict();

export type SyncHolidaysDto = z.infer<typeof SyncHolidaysDtoSchema>;
