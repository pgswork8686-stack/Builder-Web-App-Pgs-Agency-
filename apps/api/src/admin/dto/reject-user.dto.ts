import { z } from 'zod';

export const RejectUserSchema = z.object({
  reason: z
    .string({ required_error: 'Reason is required' })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 3 && val.length <= 500, {
      message: 'Reason must be between 3 and 500 characters',
    }),
});

export class RejectUserDto {
  reason!: string;
}
