import { z } from 'zod';

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
  .refine(isValidIsoDate, 'date must be a valid calendar date');

export const WorkCalendarRangeQuerySchema = z
  .object({
    from: IsoDateSchema,
    to: IsoDateSchema,
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
    // ISO day of week: 1=Monday ... 7=Sunday, matching Production DB.
    weekdayWorkingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .optional(),
    alternateSaturdayEnabled: z.boolean().optional(),
    alternateSaturdayAnchorDate: IsoDateSchema.nullable().optional(),
    alternateSaturdayAnchorIsWorking: z.boolean().optional(),
    applyGovernmentMakeupDays: z.boolean().optional(),
    holidayCountryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    holidayProvider: z.string().min(1).nullable().optional(),
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
    eventDate: IsoDateSchema,
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
    eventDate: IsoDateSchema.optional(),
    eventType: WorkCalendarEventTypeEnum.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    isWorkingDay: z.boolean().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(['pending', 'active', 'ignored']).optional(),
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
