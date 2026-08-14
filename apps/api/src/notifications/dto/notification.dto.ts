import { z } from 'zod';

const InternalActionUrlSchema = z
  .string()
  .trim()
  .regex(/^\/app\/[A-Za-z0-9/_?=&.#-]*$/)
  .refine((value) => {
    const url = new URL(value, 'https://notifications.internal');
    return (
      url.origin === 'https://notifications.internal' &&
      url.pathname.startsWith('/app/')
    );
  })
  .optional()
  .nullable();

export const NotificationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z.coerce.boolean().optional().default(false),
  })
  .strict();

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const NotificationPreferencesUpdateSchema = z
  .object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type NotificationPreferencesUpdateDto = z.infer<
  typeof NotificationPreferencesUpdateSchema
>;

export const CreateNotificationEventSchema = z
  .object({
    recipientUserId: z.string().uuid(),
    type: z.string().trim().min(2).max(80),
    title: z.string().trim().min(1).max(180),
    message: z.string().trim().min(1).max(1200),
    entityType: z.string().trim().min(2).max(80).optional().nullable(),
    entityId: z.string().uuid().optional().nullable(),
    actionUrl: InternalActionUrlSchema,
    metadata: z.record(z.unknown()).optional(),
    actorUserId: z.string().uuid().optional().nullable(),
  })
  .strict();

export type CreateNotificationEventDto = z.infer<
  typeof CreateNotificationEventSchema
>;
