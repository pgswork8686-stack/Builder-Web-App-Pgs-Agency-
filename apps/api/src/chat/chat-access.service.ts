import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface ChatMembershipAccess {
  membership: Record<string, any>;
  conversation: Record<string, any>;
}

@Injectable()
export class ChatAccessService {
  private readonly logger = new Logger(ChatAccessService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(code: string, error: unknown): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({
      code,
      message: 'Khong the kiem tra quyen chat.',
    });
  }

  async requireConversationMembership(
    conversationId: string,
    user: RequestUser,
  ): Promise<ChatMembershipAccess> {
    const { data, error } = await this.client
      .from('chat_members')
      .select('*, conversation:chat_conversations(*)')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (error) {
      this.databaseFailure('CHAT_MEMBERSHIP_LOOKUP_FAILED', error);
    }
    if (!data?.conversation) {
      throw new NotFoundException({
        code: 'CHAT_CONVERSATION_NOT_FOUND',
        message: 'Khong tim thay cuoc tro chuyen.',
      });
    }

    return {
      membership: data,
      conversation: Array.isArray(data.conversation)
        ? data.conversation[0]
        : data.conversation,
    };
  }
}
