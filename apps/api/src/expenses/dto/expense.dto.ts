import { z } from 'zod';

export const CreateExpenseSchema = z
  .object({
    projectId: z.string().uuid('projectId phải là UUID hợp lệ.'),
    title: z.string().trim().min(3).max(200),
    amount: z.number().positive('Số tiền phải lớn hơn 0.'),
    currencyCode: z.string().trim().min(2).max(10).default('VND'),
    expenseCategory: z.enum([
      'travel',
      'software_license',
      'equipment',
      'outsourcing',
      'meal_entertainment',
      'general',
    ]),
    expenseDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'Ngày chi phí phải theo định dạng YYYY-MM-DD.',
      )
      .optional(),
    receiptUrl: z
      .string()
      .url('receiptUrl không hợp lệ.')
      .optional()
      .nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;

export const ReviewExpenseSchema = z
  .object({
    action: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type ReviewExpenseDto = z.infer<typeof ReviewExpenseSchema>;

export const ExpenseQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'reimbursed']).optional(),
  category: z
    .enum([
      'travel',
      'software_license',
      'equipment',
      'outsourcing',
      'meal_entertainment',
      'general',
    ])
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
