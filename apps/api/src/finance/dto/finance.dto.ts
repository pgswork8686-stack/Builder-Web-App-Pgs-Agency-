import { z } from 'zod';

export const ContractCreateSchema = z
  .object({
    contractNumber: z.string().trim().min(2).max(80),
    clientCompanyId: z.string().uuid(),
    projectId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2).max(240),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    contractValue: z.number().positive(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    notes: z.string().trim().max(10000).optional().nullable(),
    clientVisible: z.boolean().default(false),
  })
  .strict();

export type ContractCreateDto = z.infer<typeof ContractCreateSchema>;

export const ContractUpdateSchema = ContractCreateSchema.partial().strict();
export type ContractUpdateDto = z.infer<typeof ContractUpdateSchema>;

export const ContractTransitionSchema = z
  .object({
    status: z.enum(['draft', 'active', 'completed', 'cancelled']),
  })
  .strict();

export type ContractTransitionDto = z.infer<typeof ContractTransitionSchema>;

export const InvoiceCreateSchema = z
  .object({
    invoiceNumber: z.string().trim().min(2).max(80),
    clientCompanyId: z.string().uuid(),
    projectId: z.string().uuid().optional().nullable(),
    contractId: z.string().uuid().optional().nullable(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().positive(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    notes: z.string().trim().max(10000).optional().nullable(),
    clientVisible: z.boolean().default(false),
  })
  .strict();

export type InvoiceCreateDto = z.infer<typeof InvoiceCreateSchema>;

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial().strict();
export type InvoiceUpdateDto = z.infer<typeof InvoiceUpdateSchema>;

export const InvoiceTransitionSchema = z
  .object({
    status: z.enum([
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'overdue',
      'cancelled',
    ]),
  })
  .strict();

export type InvoiceTransitionDto = z.infer<typeof InvoiceTransitionSchema>;

export const PaymentRecordSchema = z
  .object({
    amount: z.number().positive(),
    paidAt: z.string().datetime(),
    paymentReference: z.string().trim().max(160).optional().nullable(),
    paymentMethod: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .strict();

export type PaymentRecordDto = z.infer<typeof PaymentRecordSchema>;

export const FinanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().optional(),
  status: z.string().optional(),
  clientCompanyId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type FinanceQuery = z.infer<typeof FinanceQuerySchema>;
