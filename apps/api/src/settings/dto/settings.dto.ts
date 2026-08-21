import { z } from 'zod';

export const UpdateSystemSettingSchema = z
  .object({
    key: z.string().trim().min(2).max(100),
    category: z.enum([
      'general',
      'attendance',
      'finance',
      'security',
      'notifications',
    ]),
    value: z.record(z.any()),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type UpdateSystemSettingDto = z.infer<typeof UpdateSystemSettingSchema>;

export const BulkUpdateSettingsSchema = z
  .object({
    settings: z.array(UpdateSystemSettingSchema),
  })
  .strict();

export type BulkUpdateSettingsDto = z.infer<typeof BulkUpdateSettingsSchema>;
