import { z } from 'zod';

export const CreateWorkflowTemplateSchema = z
  .object({
    serviceId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
  })
  .strict();

export const UpdateWorkflowTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
  })
  .strict();

export const CreateTemplateStageSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional().nullable(),
    sortOrder: z.number().int().min(1),
    isRequired: z.boolean().default(true),
    slaHours: z.number().int().positive().optional().nullable(),
  })
  .strict();

export const UpdateTemplateStageSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    sortOrder: z.number().int().min(1).optional(),
    isRequired: z.boolean().optional(),
    slaHours: z.number().int().positive().optional().nullable(),
  })
  .strict();

export const ReorderTemplateStagesSchema = z
  .object({
    stageIds: z
      .array(z.string().uuid())
      .min(1)
      .refine((stageIds) => new Set(stageIds).size === stageIds.length, {
        message: 'WORKFLOW_STAGE_REORDER_DUPLICATE',
      }),
  })
  .strict();

export const MapStageItemSchema = z
  .object({
    serviceDeliveryItemId: z.string().uuid(),
    sortOrder: z.number().int().min(1).default(1),
    approvalRequired: z.boolean().default(false),
    approvalScope: z
      .enum(['internal', 'client', 'both'])
      .optional()
      .default('internal'),
    slaHours: z.number().int().positive().optional().nullable(),
    autoCreateTask: z.boolean().default(false),
    completionMode: z
      .enum(['manual', 'tasks_done', 'tasks_done_and_approval'])
      .default('tasks_done'),
  })
  .strict();

export const UpdateMappedStageItemSchema = MapStageItemSchema.omit({
  serviceDeliveryItemId: true,
})
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'PATCH_EMPTY',
  });

export const CreateStageDependencySchema = z
  .object({
    predecessorStageId: z.string().uuid(),
    successorStageId: z.string().uuid(),
    lagHours: z.number().int().min(0).default(0),
  })
  .strict();

export const CreateItemDependencySchema = z
  .object({
    predecessorStageItemId: z.string().uuid(),
    successorStageItemId: z.string().uuid(),
    lagHours: z.number().int().min(0).default(0),
  })
  .strict();

export const CreateApprovalRequestSchema = z
  .object({
    stageItemId: z.string().uuid().optional(),
    stageId: z.string().uuid().optional(),
    approvalType: z.enum(['internal', 'client']).default('internal'),
    requestNote: z.string().optional().nullable(),
  })
  .strict()
  .refine(
    (value) =>
      Number(value.stageItemId !== undefined) +
        Number(value.stageId !== undefined) ===
      1,
    { message: 'WORKFLOW_APPROVAL_TARGET_INVALID' },
  );

export const OverrideDependencySchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const RespondApprovalSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    decisionNote: z.string().optional().nullable(),
  })
  .strict();

export type CreateWorkflowTemplateDto = z.infer<
  typeof CreateWorkflowTemplateSchema
>;
export type UpdateWorkflowTemplateDto = z.infer<
  typeof UpdateWorkflowTemplateSchema
>;
export type CreateTemplateStageDto = z.infer<typeof CreateTemplateStageSchema>;
export type UpdateTemplateStageDto = z.infer<typeof UpdateTemplateStageSchema>;
export type ReorderTemplateStagesDto = z.infer<
  typeof ReorderTemplateStagesSchema
>;
export type MapStageItemDto = z.infer<typeof MapStageItemSchema>;
export type UpdateMappedStageItemDto = z.infer<
  typeof UpdateMappedStageItemSchema
>;
export type CreateStageDependencyDto = z.infer<
  typeof CreateStageDependencySchema
>;
export type CreateItemDependencyDto = z.infer<
  typeof CreateItemDependencySchema
>;
export type CreateApprovalRequestDto = z.infer<
  typeof CreateApprovalRequestSchema
>;
export type RespondApprovalDto = z.infer<typeof RespondApprovalSchema>;
