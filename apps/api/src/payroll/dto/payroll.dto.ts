import { z } from 'zod';

export const GeneratePayrollRunSchema = z
  .object({
    periodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Tháng tính lương phải theo định dạng YYYY-MM.'),
    title: z.string().trim().min(3).max(200),
    standardWorkingDays: z.number().int().min(15).max(31).default(22),
  })
  .strict();

export type GeneratePayrollRunDto = z.infer<typeof GeneratePayrollRunSchema>;

export const UpdatePayslipAdjustmentSchema = z
  .object({
    allowances: z.number().min(0).optional(),
    bonus: z.number().min(0).optional(),
    deductions: z.number().min(0).optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type UpdatePayslipAdjustmentDto = z.infer<
  typeof UpdatePayslipAdjustmentSchema
>;

export const PayrollRunQuerySchema = z.object({
  status: z
    .enum(['draft', 'calculated', 'approved', 'paid', 'locked'])
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PayrollRunQuery = z.infer<typeof PayrollRunQuerySchema>;
