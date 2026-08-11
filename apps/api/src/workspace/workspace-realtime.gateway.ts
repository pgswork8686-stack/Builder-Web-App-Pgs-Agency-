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
import { WorkspaceAccessService } from './workspace-access.service';

export interface WorkspaceEvent {
  projectId: string;
  entityId: string;
  event:
    | 'task.created'
    | 'task.updated'
    | 'task.moved'
    | 'comment.created'
    | 'comment.updated'
    | 'comment.deleted'
    | 'file.created'
    | 'file.deleted';
  updatedAt: string;
  changes?: Record<string, unknown>;
}

const JoinProjectSchema = z.object({ projectId: z.string().uuid() }).strict();

@WebSocketGateway({
  namespace: '/project-workspace',
  cors: {
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class WorkspaceRealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(WorkspaceRealtimeGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly accessService: WorkspaceAccessService,
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
      client.emit('workspace.error', { code: 'REALTIME_AUTH_FAILED' });
      client.disconnect(true);
      return;
    }

    const systemClient = this.supabaseService.getSystemClient();
    const { data: authData, error: authError } =
      await systemClient.auth.getUser(token);
    if (authError || !authData?.user) {
      client.emit('workspace.error', { code: 'REALTIME_AUTH_FAILED' });
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
          `Realtime profile lookup failed: ${profileError.message}`,
        );
      }
      client.emit('workspace.error', { code: 'REALTIME_AUTH_FAILED' });
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

  @SubscribeMessage('workspace.join')
  async joinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const user = client.data.user as RequestUser | undefined;
    if (!user) {
      return { ok: false, error: { code: 'REALTIME_AUTH_FAILED' } };
    }
    const parsed = JoinProjectSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: 'REALTIME_ACCESS_DENIED' } };
    }

    try {
      await this.accessService.requireProjectAccess(
        parsed.data.projectId,
        user,
        'REALTIME_ACCESS_DENIED',
      );
      for (const room of client.rooms) {
        if (room.startsWith('project:')) await client.leave(room);
      }
      await client.join(`project:${parsed.data.projectId}`);
      return { ok: true, projectId: parsed.data.projectId };
    } catch {
      return { ok: false, error: { code: 'REALTIME_ACCESS_DENIED' } };
    }
  }

  emitProjectEvent(event: WorkspaceEvent): void {
    if (!this.server) return;
    const room = this.server.to(`project:${event.projectId}`);
    room.emit(event.event, event);
    room.emit('workspace.event', event);
  }
}
