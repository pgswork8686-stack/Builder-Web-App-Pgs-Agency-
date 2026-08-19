import { z } from 'zod';

export const CreateDocumentUploadSessionSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    category: z.enum([
      'policy_procedure',
      'contract_template',
      'marketing_asset',
      'brand_guidelines',
      'financial_report',
      'general',
    ]),
    accessLevel: z
      .enum(['public_company', 'internal_only', 'management_only'])
      .default('public_company'),
    departmentId: z.string().uuid().optional().nullable(),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024), // Max 50MB
    version: z.string().trim().max(20).default('1.0'),
  })
  .strict();

export type CreateDocumentUploadSessionDto = z.infer<
  typeof CreateDocumentUploadSessionSchema
>;

export const FinalizeDocumentSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    category: z.enum([
      'policy_procedure',
      'contract_template',
      'marketing_asset',
      'brand_guidelines',
      'financial_report',
      'general',
    ]),
    accessLevel: z
      .enum(['public_company', 'internal_only', 'management_only'])
      .default('public_company'),
    departmentId: z.string().uuid().optional().nullable(),
    storagePath: z.string().trim().min(1),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1),
    sizeBytes: z.number().int().positive(),
    version: z.string().trim().max(20).default('1.0'),
  })
  .strict();

export type FinalizeDocumentDto = z.infer<typeof FinalizeDocumentSchema>;

export const DocumentQuerySchema = z.object({
  category: z
    .enum([
      'policy_procedure',
      'contract_template',
      'marketing_asset',
      'brand_guidelines',
      'financial_report',
      'general',
    ])
    .optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;
