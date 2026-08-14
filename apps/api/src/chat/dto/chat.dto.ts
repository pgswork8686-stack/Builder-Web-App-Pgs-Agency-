import { z } from 'zod';

export const ChatConversationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ChatConversationQuery = z.infer<typeof ChatConversationQuerySchema>;

export const CreateDirectConversationSchema = z
  .object({
    peerUserId: z.string().uuid(),
  })
  .strict();

export type CreateDirectConversationDto = z.infer<
  typeof CreateDirectConversationSchema
>;

export const ChatMessageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().datetime().optional(),
  })
  .strict();

export type ChatMessageQuery = z.infer<typeof ChatMessageQuerySchema>;

export const SendChatMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(4000),
  })
  .strict();

export type SendChatMessageDto = z.infer<typeof SendChatMessageSchema>;
