import { z } from 'zod';

export const CreateSupportTicketSchema = z
  .object({
    clientCompanyId: z.string().uuid().optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(5).max(4000),
    category: z
      .enum(['technical', 'billing', 'project_scope', 'bug_report', 'general'])
      .default('general'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  })
  .strict();

export type CreateSupportTicketDto = z.infer<typeof CreateSupportTicketSchema>;

export const CreateTicketMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(4000),
    isInternalNote: z.boolean().default(false),
  })
  .strict();

export type CreateTicketMessageDto = z.infer<typeof CreateTicketMessageSchema>;

export const UpdateTicketStatusSchema = z
  .object({
    status: z.enum([
      'open',
      'in_progress',
      'waiting_client',
      'resolved',
      'closed',
    ]),
    assigneeUserId: z.string().uuid().optional().nullable(),
  })
  .strict();

export type UpdateTicketStatusDto = z.infer<typeof UpdateTicketStatusSchema>;

export const SupportTicketQuerySchema = z.object({
  status: z
    .enum(['open', 'in_progress', 'waiting_client', 'resolved', 'closed'])
    .optional(),
  category: z
    .enum(['technical', 'billing', 'project_scope', 'bug_report', 'general'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  clientCompanyId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SupportTicketQuery = z.infer<typeof SupportTicketQuerySchema>;
