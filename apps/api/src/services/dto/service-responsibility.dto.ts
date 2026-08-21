import { z } from 'zod';

const UuidListSchema = z.array(z.string().uuid()).max(50);

export const UpdateServiceResponsibilitySchema = z
  .object({
    ownerDepartmentId: z.string().uuid(),
    ownerTeamId: z.string().uuid().nullable().optional().default(null),
    collaboratorDepartmentIds: UuidListSchema.optional().default([]),
    collaboratorTeamIds: UuidListSchema.optional().default([]),
  })
  .strict();

export type UpdateServiceResponsibilityDto = z.infer<
  typeof UpdateServiceResponsibilitySchema
>;
