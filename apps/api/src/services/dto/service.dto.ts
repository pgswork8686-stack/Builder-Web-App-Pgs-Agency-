import { z } from 'zod';

export const CreateServiceSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();

export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = z
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
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;

export const ServiceListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ServiceListQuery = z.infer<typeof ServiceListQuerySchema>;
