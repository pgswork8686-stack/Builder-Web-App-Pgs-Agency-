import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { AccountStatus, AppRole, RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatAccessService } from './chat-access.service';

const JoinConversationSchema = z
  .object({ conversationId: z.string().uuid() })
  .strict();

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatRealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatRealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: ChatAccessService,
  ) {}

  private tokenFrom(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }
    const header = client.handshake.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value === 'string' && value.startsWith('Bearer ')) {
      const token = value.substring(7).trim();
      return token || null;
    }
    return null;
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.tokenFrom(client);
    if (!token) {
      client.emit('chat.error', { code: 'REALTIME_AUTH_FAILED' });
      client.disconnect(true);
      return;
    }

    const systemClient = this.supabaseService.getSystemClient();
    const { data: authData, error: authError } =
      await systemClient.auth.getUser(token);
    if (authError || !authData?.user) {
      client.emit('chat.error', { code: 'REALTIME_AUTH_FAILED' });
      client.disconnect(true);
      return;
    }

    const { data: profile, error: profileError } = await systemClient
      .from('profiles')
      .select('id,email,full_name,avatar_url,role,account_status,approved_at')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.account_status !== 'active' ||
      !profile.role
    ) {
      if (profileError) {
        this.logger.error(
          `Chat socket profile lookup failed: ${profileError.message}`,
        );
      }
      client.emit('chat.error', { code: 'REALTIME_AUTH_FAILED' });
      client.disconnect(true);
      return;
    }

    const user: RequestUser = {
      authUserId: authData.user.id,
      profileId: profile.id,
      email: authData.user.email ?? null,
      phone: authData.user.phone ?? null,
      accountStatus: profile.account_status as AccountStatus,
      role: profile.role as AppRole,
      fullName: profile.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      approvedAt: profile.approved_at ?? null,
    };
    client.data.user = user;
  }

  @SubscribeMessage('chat.join')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const user = client.data.user as RequestUser | undefined;
    if (!user) {
      return { ok: false, error: { code: 'REALTIME_AUTH_FAILED' } };
    }
    const parsed = JoinConversationSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: 'CHAT_ACCESS_DENIED' } };
    }

    try {
      await this.accessService.requireConversationMembership(
        parsed.data.conversationId,
        user,
      );
      await client.join(`chat:${parsed.data.conversationId}`);
      return { ok: true, conversationId: parsed.data.conversationId };
    } catch {
      return { ok: false, error: { code: 'CHAT_ACCESS_DENIED' } };
    }
  }

  emitConversation(
    conversationId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server?.to(`chat:${conversationId}`).emit(event, payload);
  }
}
