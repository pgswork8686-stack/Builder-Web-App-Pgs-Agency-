import { z } from 'zod';

export const CreateClientCompanySchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => !v || (v.length >= 2 && v.length <= 30), {
      message:
        'Mã khách hàng phải từ 2 đến 30 ký tự (ví dụ: KH_01 hoặc PGS-VNG).',
    })
    .optional()
    .nullable(),
  name: z.string().min(2, 'Tên khách hàng phải từ 2 ký tự'),
  taxCode: z.string().optional().nullable(),
  email: z
    .string()
    .email('Email không hợp lệ')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().optional().nullable(),
});

export type CreateClientCompanyDto = z.infer<typeof CreateClientCompanySchema>;

export const UpdateClientCompanySchema = z
  .object({
    name: z.string().min(2, 'Tên khách hàng phải từ 2 ký tự').optional(),
    taxCode: z.string().optional().nullable(),
    email: z
      .string()
      .email('Email không hợp lệ')
      .optional()
      .nullable()
      .or(z.literal('')),
    phone: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive']).optional(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (d) => Object.keys(d).some((k) => d[k as keyof typeof d] !== undefined),
    { message: 'Phải cung cấp ít nhất một trường để cập nhật.' },
  );

export type UpdateClientCompanyDto = z.infer<typeof UpdateClientCompanySchema>;

export const CreateClientMembershipSchema = z.object({
  userId: z.string().uuid('userId phải là định dạng UUID hợp lệ'),
  title: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export type CreateClientMembershipDto = z.infer<
  typeof CreateClientMembershipSchema
>;

export const UpdateClientMembershipSchema = z
  .object({
    title: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
  })
  .refine((d) => d.title !== undefined || d.isPrimary !== undefined, {
    message:
      'Phải cung cấp ít nhất một trường để cập nhật (title hoặc isPrimary).',
  });

export type UpdateClientMembershipDto = z.infer<
  typeof UpdateClientMembershipSchema
>;
