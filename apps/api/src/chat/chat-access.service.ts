import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AppRole, RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface ChatMembershipAccess {
  membership: Record<string, any>;
  conversation: Record<string, any>;
}

type LiveChatProfile = {
  id: string;
  role: AppRole | null;
  account_status: string | null;
};

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

  private denyConversationAccess(): never {
    // Treat a stale or out-of-scope conversation exactly like a missing one so
    // callers cannot use this endpoint to enumerate chat history.
    throw new NotFoundException({
      code: 'CHAT_CONVERSATION_NOT_FOUND',
      message: 'Khong tim thay cuoc tro chuyen.',
    });
  }

  private normalizeJoinedRow(value: unknown): Record<string, any> | null {
    if (Array.isArray(value)) {
      return (value[0] as Record<string, any> | undefined) ?? null;
    }
    return (value as Record<string, any> | null) ?? null;
  }

  private async getLiveProfile(userId: string): Promise<LiveChatProfile> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,role,account_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.databaseFailure('CHAT_PROFILE_LOOKUP_FAILED', error);
    }
    if (!data?.id || data.account_status !== 'active' || !data.role) {
      this.denyConversationAccess();
    }

    return {
      id: data.id,
      role: data.role as AppRole,
      account_status: data.account_status,
    };
  }

  private async requireDirectConversationScope(
    conversation: Record<string, any>,
    actor: LiveChatProfile,
  ): Promise<void> {
    const participantIds = [
      conversation.direct_user_low,
      conversation.direct_user_high,
    ];
    if (
      actor.role === 'client' ||
      participantIds.some((id) => typeof id !== 'string') ||
      !participantIds.includes(actor.id)
    ) {
      this.denyConversationAccess();
    }

    const { data: participants, error } = await this.client
      .from('profiles')
      .select('id,role,account_status')
      .in('id', participantIds);

    if (error) {
      this.databaseFailure('CHAT_DIRECT_PARTICIPANTS_LOOKUP_FAILED', error);
    }

    if (
      (participants ?? []).length !== 2 ||
      (participants ?? []).some(
        (participant) =>
          participant.account_status !== 'active' ||
          !participant.role ||
          participant.role === 'client',
      )
    ) {
      this.denyConversationAccess();
    }
  }

  private async requireProjectConversationScope(
    conversation: Record<string, any>,
    actor: LiveChatProfile,
  ): Promise<void> {
    const project = this.normalizeJoinedRow(conversation.project);
    const projectId = conversation.project_id ?? project?.id;
    const clientCompanyId = project?.client_company_id;

    if (!projectId || !clientCompanyId) {
      this.denyConversationAccess();
    }

    if (actor.role === 'admin') {
      return;
    }

    if (actor.role === 'client') {
      const { data, error } = await this.client
        .from('client_memberships')
        .select('id')
        .eq('user_id', actor.id)
        .eq('client_company_id', clientCompanyId)
        .maybeSingle();

      if (error) {
        this.databaseFailure('CHAT_CLIENT_MEMBERSHIP_LOOKUP_FAILED', error);
      }
      if (!data) {
        this.denyConversationAccess();
      }
      return;
    }

    const { data, error } = await this.client
      .from('project_memberships')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', actor.id)
      .neq('project_role', 'client_contact')
      .maybeSingle();

    if (error) {
      this.databaseFailure('CHAT_PROJECT_MEMBERSHIP_LOOKUP_FAILED', error);
    }
    if (!data) {
      this.denyConversationAccess();
    }
  }

  private async requireLiveConversationScope(
    conversation: Record<string, any>,
    userId: string,
  ): Promise<void> {
    const actor = await this.getLiveProfile(userId);
    if (conversation.type === 'direct') {
      await this.requireDirectConversationScope(conversation, actor);
      return;
    }
    if (conversation.type === 'project') {
      await this.requireProjectConversationScope(conversation, actor);
      return;
    }
    this.denyConversationAccess();
  }

  async requireConversationMembership(
    conversationId: string,
    user: RequestUser,
  ): Promise<ChatMembershipAccess> {
    const { data, error } = await this.client
      .from('chat_members')
      .select(
        '*, conversation:chat_conversations(*, project:projects(id,client_company_id))',
      )
      .eq('conversation_id', conversationId)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (error) {
      this.databaseFailure('CHAT_MEMBERSHIP_LOOKUP_FAILED', error);
    }
    const conversation = this.normalizeJoinedRow(data?.conversation);
    if (!data || !conversation) this.denyConversationAccess();

    await this.requireLiveConversationScope(conversation, user.profileId);

    return {
      membership: data,
      conversation,
    };
  }

  async listAccessibleConversationMemberships(
    user: RequestUser,
  ): Promise<Record<string, any>[]> {
    const { data, error } = await this.client
      .from('chat_members')
      .select(
        '*, conversation:chat_conversations(*, project:projects(id,project_code,name,client_company_id))',
      )
      .eq('user_id', user.profileId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      this.databaseFailure('CHAT_CONVERSATIONS_LOOKUP_FAILED', error);
    }

    const accessible = await Promise.all(
      (data ?? []).map(async (membership) => {
        try {
          await this.requireConversationMembership(
            String(membership.conversation_id),
            user,
          );
          return membership as Record<string, any>;
        } catch (accessError) {
          if (accessError instanceof InternalServerErrorException) {
            throw accessError;
          }
          return null;
        }
      }),
    );

    return accessible.filter(
      (membership): membership is Record<string, any> => membership !== null,
    );
  }

  async listAuthorizedConversationUserIds(
    conversationId: string,
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from('chat_members')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (error) {
      this.databaseFailure('CHAT_RECIPIENTS_LOOKUP_FAILED', error);
    }

    const candidateIds = [
      ...new Set((data ?? []).map((row) => row.user_id)),
    ].filter((userId): userId is string => typeof userId === 'string');
    const authorized = await Promise.all(
      candidateIds.map(async (userId) => {
        try {
          await this.requireConversationMembership(conversationId, {
            profileId: userId,
          } as RequestUser);
          return userId;
        } catch (accessError) {
          if (accessError instanceof InternalServerErrorException) {
            throw accessError;
          }
          return null;
        }
      }),
    );

    return authorized.filter((userId): userId is string => userId !== null);
  }
}
