import { z } from 'zod';

export const CreateServiceCategorySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Mã nhóm phải từ 2 ký tự')
      .max(40, 'Mã nhóm tối đa 40 ký tự')
      .transform((value) => value.toUpperCase()),
    name: z
      .string()
      .trim()
      .min(2, 'Tên nhóm dịch vụ phải từ 2 ký tự')
      .max(160, 'Tên nhóm dịch vụ tối đa 160 ký tự'),
    description: z.string().trim().max(5000).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional().default(0),
    active: z.boolean().optional().default(true),
  })
  .strict();

export type CreateServiceCategoryDto = z.infer<
  typeof CreateServiceCategorySchema
>;

export const UpdateServiceCategorySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((value) => value.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type UpdateServiceCategoryDto = z.infer<
  typeof UpdateServiceCategorySchema
>;

export const ServiceCategoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ServiceCategoryQuery = z.infer<typeof ServiceCategoryQuerySchema>;
