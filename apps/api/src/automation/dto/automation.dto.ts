import { z } from 'zod';

export const AutomationTriggerSchema = z.enum([
  'task.created',
  'task.assigned',
  'task.updated',
  'task.due_soon',
  'project.updated',
  'leave.submitted',
  'leave.approved',
  'leave.rejected',
  'attendance.adjustment_requested',
  'contract.status_changed',
  'invoice.issued',
  'invoice.overdue',
  'invoice.payment_recorded',
  'chat.message',
  'workflow.started',
  'workflow.stage.ready',
  'workflow.stage.started',
  'workflow.stage.completed',
  'workflow.item.ready',
  'workflow.item.blocked',
  'workflow.item.completed',
  'workflow.approval.requested',
  'workflow.approval.approved',
  'workflow.approval.rejected',
  'workflow.sla.due_soon',
  'workflow.sla.breached',
]);

export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;

export const AutomationActionSchema = z.enum(['create_notification']);

export const AutomationRuleQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    triggerType: AutomationTriggerSchema.optional(),
    enabled: z.coerce.boolean().optional(),
  })
  .strict();

export type AutomationRuleQuery = z.infer<typeof AutomationRuleQuerySchema>;

const JsonObjectSchema = z.record(z.unknown());

export const AutomationRuleCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    triggerType: AutomationTriggerSchema,
    conditions: JsonObjectSchema.default({}),
    actionType: AutomationActionSchema.default('create_notification'),
    actionConfig: JsonObjectSchema.default({}),
    isEnabled: z.boolean().default(true),
  })
  .strict();

export type AutomationRuleCreateDto = z.infer<
  typeof AutomationRuleCreateSchema
>;

export const AutomationRuleUpdateSchema = AutomationRuleCreateSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export type AutomationRuleUpdateDto = z.infer<
  typeof AutomationRuleUpdateSchema
>;

export const AutomationExecutionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    ruleId: z.string().uuid().optional(),
    triggerType: AutomationTriggerSchema.optional(),
    status: z.enum(['running', 'success', 'failed', 'skipped']).optional(),
  })
  .strict();

export type AutomationExecutionsQuery = z.infer<
  typeof AutomationExecutionsQuerySchema
>;

export const AutomationManualEventSchema = z
  .object({
    triggerType: AutomationTriggerSchema,
    eventKey: z.string().trim().min(8).max(200),
    payload: JsonObjectSchema.default({}),
  })
  .strict();

export type AutomationManualEventDto = z.infer<
  typeof AutomationManualEventSchema
>;
