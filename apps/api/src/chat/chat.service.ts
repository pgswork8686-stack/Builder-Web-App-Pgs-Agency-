import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AutomationService } from '../automation/automation.service';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatAccessService } from './chat-access.service';
import { ChatRealtimeGateway } from './chat-realtime.gateway';
import type {
  ChatConversationQuery,
  ChatMessageQuery,
  CreateDirectConversationDto,
  SendChatMessageDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: ChatAccessService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly automation?: AutomationService,
    @Optional() private readonly realtime?: ChatRealtimeGateway,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private databaseFailure(
    code: string,
    message: string,
    error: unknown,
  ): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({ code, message });
  }

  private mapConversation(row: Record<string, any>, user: RequestUser) {
    const conversation = Array.isArray(row.conversation)
      ? row.conversation[0]
      : row.conversation;
    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title ?? null,
      projectId: conversation.project_id ?? null,
      project: conversation.project ?? null,
      directUserLow: conversation.direct_user_low ?? null,
      directUserHigh: conversation.direct_user_high ?? null,
      lastMessageAt: conversation.last_message_at ?? null,
      readAt: row.read_at ?? null,
      hasUnread:
        Boolean(conversation.last_message_at) &&
        (!row.read_at || conversation.last_message_at > row.read_at),
      currentUserId: user.profileId,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };
  }

  private mapMessage(row: Record<string, any>) {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderUserId: row.sender_user_id,
      sender: row.sender ?? null,
      content: row.content,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }

  private mapRpcError(error: any): never {
    const message = error?.message ?? '';
    if (
      message.includes('DIRECT_CHAT_INVALID_PARTICIPANTS') ||
      message.includes('DIRECT_CHAT_INTERNAL_ACTIVE_USERS_REQUIRED')
    ) {
      throw new BadRequestException({
        code: 'DIRECT_CHAT_INVALID_PARTICIPANTS',
        message: 'Direct chat chi danh cho nguoi dung noi bo dang hoat dong.',
      });
    }
    if (message.includes('PROJECT_CHAT_ACCESS_DENIED')) {
      throw new NotFoundException({
        code: 'PROJECT_CHAT_NOT_FOUND',
        message: 'Khong tim thay project chat hoac khong co quyen xem.',
      });
    }
    if (message.includes('PROJECT_NOT_FOUND')) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Khong tim thay du an.',
      });
    }
    this.databaseFailure(
      'CHAT_RPC_FAILED',
      'Khong the xu ly yeu cau chat.',
      error,
    );
  }

  async listConversations(query: ChatConversationQuery, user: RequestUser) {
    const memberships =
      await this.accessService.listAccessibleConversationMemberships(user);
    const offset = (query.page - 1) * query.pageSize;
    const total = memberships.length;
    return {
      items: memberships
        .slice(offset, offset + query.pageSize)
        .map((row) => this.mapConversation(row, user)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async unreadCount(user: RequestUser) {
    const memberships =
      await this.accessService.listAccessibleConversationMemberships(user);
    const unreadChecks = await Promise.all(
      memberships.map(async (membership) => {
        const { data, error } = await this.client
          .from('chat_messages')
          .select('id')
          .eq('conversation_id', membership.conversation_id)
          .neq('sender_user_id', user.profileId)
          .gt('created_at', membership.read_at ?? '1970-01-01T00:00:00.000Z')
          .limit(1);

        if (error) {
          this.databaseFailure(
            'CHAT_UNREAD_COUNT_FAILED',
            'Khong the dem tin nhan chua doc.',
            error,
          );
        }
        return (data?.length ?? 0) > 0;
      }),
    );
    return { unreadCount: unreadChecks.filter(Boolean).length };
  }

  async createDirectConversation(
    dto: CreateDirectConversationDto,
    user: RequestUser,
  ) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'DIRECT_CHAT_ACCESS_DENIED',
        message: 'Khach hang chi co the tham gia project chat duoc uy quyen.',
      });
    }

    const { data, error } = await this.client.rpc(
      'phase7_create_direct_conversation',
      {
        p_actor_user_id: user.profileId,
        p_peer_user_id: dto.peerUserId,
      },
    );

    if (error) this.mapRpcError(error);
    return this.getConversationById(String(data), user);
  }

  async getOrCreateProjectConversation(projectId: string, user: RequestUser) {
    const { data, error } = await this.client.rpc(
      'phase7_get_or_create_project_conversation',
      {
        p_project_id: projectId,
        p_actor_user_id: user.profileId,
      },
    );

    if (error) this.mapRpcError(error);
    return this.getConversationById(String(data), user);
  }

  async getConversationById(conversationId: string, user: RequestUser) {
    const access = await this.accessService.requireConversationMembership(
      conversationId,
      user,
    );
    const { data, error } = await this.client
      .from('chat_members')
      .select(
        '*, conversation:chat_conversations(*, project:projects(id,project_code,name))',
      )
      .eq('conversation_id', access.conversation.id)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'CHAT_CONVERSATION_LOOKUP_FAILED',
        'Khong the tai cuoc tro chuyen.',
        error,
      );
    }
    if (!data) {
      throw new NotFoundException({
        code: 'CHAT_CONVERSATION_NOT_FOUND',
        message: 'Khong tim thay cuoc tro chuyen.',
      });
    }
    return this.mapConversation(data as Record<string, any>, user);
  }

  async listMessages(
    conversationId: string,
    query: ChatMessageQuery,
    user: RequestUser,
  ) {
    await this.accessService.requireConversationMembership(
      conversationId,
      user,
    );
    let dbQuery = this.client
      .from('chat_messages')
      .select(
        '*, sender:profiles!chat_messages_sender_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .eq('conversation_id', conversationId);

    if (query.before) {
      dbQuery = dbQuery.lt('created_at', query.before);
    }

    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(query.limit);

    if (error) {
      this.databaseFailure(
        'CHAT_MESSAGES_LOOKUP_FAILED',
        'Khong the tai lich su chat.',
        error,
      );
    }

    const rows = ((data ?? []) as Record<string, any>[]).map((row) =>
      this.mapMessage(row),
    );
    const nextBefore =
      rows.length === query.limit
        ? (rows[rows.length - 1]?.createdAt ?? null)
        : null;
    return {
      items: rows.reverse(),
      nextBefore,
    };
  }

  async sendMessage(
    conversationId: string,
    dto: SendChatMessageDto,
    user: RequestUser,
  ) {
    await this.accessService.requireConversationMembership(
      conversationId,
      user,
    );

    const { data, error } = await this.client
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_user_id: user.profileId,
        content: dto.content.trim(),
        metadata: {},
      })
      .select(
        '*, sender:profiles!chat_messages_sender_user_id_fkey(id,full_name,email,avatar_url)',
      )
      .single();

    if (error) {
      this.databaseFailure(
        'CHAT_MESSAGE_CREATE_FAILED',
        'Khong the gui tin nhan.',
        error,
      );
    }

    const message = this.mapMessage(data as Record<string, any>);
    try {
      this.realtime?.emitConversation(
        conversationId,
        'chat:message:new',
        message,
      );
    } catch (realtimeError) {
      this.logSideEffectFailure('realtime broadcast', realtimeError);
    }

    let recipients: string[] = [];
    try {
      recipients =
        await this.accessService.listAuthorizedConversationUserIds(
          conversationId,
        );
      recipients = recipients.filter(
        (recipient) => recipient !== user.profileId,
      );
    } catch (recipientError) {
      this.logSideEffectFailure('recipient lookup', recipientError);
    }

    try {
      await this.notificationsService.createForUsers(recipients, {
        type: 'chat.message',
        title: 'Tin nhắn mới',
        message: `${user.fullName ?? user.email ?? 'Thanh vien'} da gui tin nhan moi.`,
        entityType: 'chat_conversation',
        entityId: conversationId,
        actionUrl: `/app/chat?conversationId=${conversationId}`,
        metadata: { messageId: message.id },
        actorUserId: user.profileId,
      });
    } catch (notificationError) {
      this.logSideEffectFailure('notification delivery', notificationError);
    }

    try {
      await this.automation?.runEvent({
        triggerType: 'chat.message',
        eventKey: `chat.message:${message.id}`,
        payload: {
          conversationId,
          messageId: message.id,
          senderUserId: user.profileId,
        },
        actorUserId: user.profileId,
        defaultRecipients: recipients,
        title: 'Tin nhan moi',
        message: `${user.fullName ?? user.email ?? 'Thanh vien'} da gui tin nhan moi.`,
        entityType: 'chat_message',
        entityId: message.id,
        actionUrl: `/app/chat?conversationId=${conversationId}`,
      });
    } catch (automationError) {
      this.logSideEffectFailure('automation', automationError);
    }

    return message;
  }

  async markRead(conversationId: string, user: RequestUser) {
    await this.accessService.requireConversationMembership(
      conversationId,
      user,
    );
    const { data, error } = await this.client.rpc(
      'phase7_mark_conversation_read',
      {
        p_conversation_id: conversationId,
        p_user_id: user.profileId,
      },
    );
    if (error) {
      this.databaseFailure(
        'CHAT_MARK_READ_FAILED',
        'Khong the danh dau chat da doc.',
        error,
      );
    }
    try {
      this.realtime?.emitConversation(conversationId, 'chat:read', {
        conversationId,
        userId: user.profileId,
        readAt: data?.read_at ?? new Date().toISOString(),
      });
    } catch (realtimeError) {
      this.logSideEffectFailure('read receipt broadcast', realtimeError);
    }
    return {
      conversationId,
      readAt: data?.read_at ?? null,
    };
  }

  private logSideEffectFailure(operation: string, error: unknown): void {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error);
    this.logger.error(
      `Chat ${operation} failed after message persistence: ${detail}`,
    );
  }
}
