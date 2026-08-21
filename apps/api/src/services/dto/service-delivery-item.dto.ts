import { z } from 'zod';

export const CreateServiceDeliveryItemSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tên hạng mục không được để trống')
      .max(255, 'Tên hạng mục tối đa 255 ký tự'),
    description: z.string().trim().max(5000).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional().default(0),
    isRequired: z.boolean().optional().default(true),
    active: z.boolean().optional().default(true),
  })
  .strict();

export type CreateServiceDeliveryItemDto = z.infer<
  typeof CreateServiceDeliveryItemSchema
>;

export const UpdateServiceDeliveryItemSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isRequired: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type UpdateServiceDeliveryItemDto = z.infer<
  typeof UpdateServiceDeliveryItemSchema
>;
