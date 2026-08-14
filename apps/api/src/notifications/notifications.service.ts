import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateNotificationEventDto,
  NotificationListQuery,
  NotificationPreferencesUpdateDto,
} from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly gateway?: NotificationsGateway,
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

  private mapNotification(row: Record<string, any>) {
    return {
      id: row.id,
      recipientUserId: row.recipient_user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      entityType: row.entity_type ?? null,
      entityId: row.entity_id ?? null,
      actionUrl: row.action_url ?? null,
      metadata: row.metadata ?? {},
      readAt: row.read_at ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
    };
  }

  private async isInAppEnabled(userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('notification_preferences')
      .select('in_app_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_PREFERENCES_LOOKUP_FAILED',
        'Khong the kiem tra tuy chon thong bao.',
        error,
      );
    }

    return data?.in_app_enabled !== false;
  }

  async list(query: NotificationListQuery, user: RequestUser) {
    const offset = (query.page - 1) * query.pageSize;
    let dbQuery = this.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_user_id', user.profileId);

    if (query.unreadOnly) {
      dbQuery = dbQuery.is('read_at', null);
    }

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.databaseFailure(
        'NOTIFICATIONS_LOOKUP_FAILED',
        'Khong the tai danh sach thong bao.',
        error,
      );
    }

    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapNotification(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async unreadCount(user: RequestUser) {
    const { count, error } = await this.client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', user.profileId)
      .is('read_at', null);

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_UNREAD_COUNT_FAILED',
        'Khong the dem thong bao chua doc.',
        error,
      );
    }

    return { unreadCount: count ?? 0 };
  }

  async markRead(notificationId: string, user: RequestUser) {
    const { data, error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_user_id', user.profileId)
      .is('read_at', null)
      .select()
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_MARK_READ_FAILED',
        'Khong the danh dau thong bao da doc.',
        error,
      );
    }
    if (data) {
      const mapped = this.mapNotification(data);
      this.gateway?.emitToUser(user.profileId, 'notifications:read', mapped);
      return mapped;
    }

    const { data: existing, error: existingError } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('recipient_user_id', user.profileId)
      .maybeSingle();

    if (existingError) {
      this.databaseFailure(
        'NOTIFICATION_MARK_READ_LOOKUP_FAILED',
        'Khong the kiem tra thong bao.',
        existingError,
      );
    }
    if (!existing) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Khong tim thay thong bao.',
      });
    }

    return this.mapNotification(existing);
  }

  async markAllRead(user: RequestUser) {
    const { data, error } = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', user.profileId)
      .is('read_at', null)
      .select('id');

    if (error) {
      this.databaseFailure(
        'NOTIFICATIONS_MARK_ALL_READ_FAILED',
        'Khong the danh dau tat ca thong bao da doc.',
        error,
      );
    }

    const updated = data?.length ?? 0;
    this.gateway?.emitToUser(user.profileId, 'notifications:read-all', {
      updated,
    });
    return { updated };
  }

  async getPreferences(user: RequestUser) {
    const { data, error } = await this.client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_PREFERENCES_LOOKUP_FAILED',
        'Khong the tai tuy chon thong bao.',
        error,
      );
    }

    return {
      userId: user.profileId,
      inAppEnabled: data?.in_app_enabled ?? true,
      emailEnabled: data?.email_enabled ?? false,
      preferences: data?.preferences ?? {},
      updatedAt: data?.updated_at ?? null,
    };
  }

  async updatePreferences(
    dto: NotificationPreferencesUpdateDto,
    user: RequestUser,
  ) {
    const payload: {
      user_id: string;
      updated_by: string;
      in_app_enabled?: boolean;
      email_enabled?: boolean;
    } = {
      user_id: user.profileId,
      updated_by: user.profileId,
    };
    if (dto.inAppEnabled !== undefined) {
      payload.in_app_enabled = dto.inAppEnabled;
    }
    if (dto.emailEnabled !== undefined) {
      payload.email_enabled = dto.emailEnabled;
    }

    const { data, error } = await this.client
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_PREFERENCES_UPDATE_FAILED',
        'Khong the luu tuy chon thong bao.',
        error,
      );
    }

    return {
      userId: data.user_id,
      inAppEnabled: data.in_app_enabled,
      emailEnabled: data.email_enabled,
      preferences: data.preferences ?? {},
      updatedAt: data.updated_at,
    };
  }

  async createForUser(input: CreateNotificationEventDto) {
    if (input.actorUserId && input.actorUserId === input.recipientUserId) {
      return null;
    }
    const enabled = await this.isInAppEnabled(input.recipientUserId);
    if (!enabled) {
      return null;
    }

    const { data, error } = await this.client
      .from('notifications')
      .insert({
        recipient_user_id: input.recipientUserId,
        type: input.type.trim(),
        title: input.title.trim(),
        message: input.message.trim(),
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        action_url: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        created_by: input.actorUserId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'NOTIFICATION_CREATE_FAILED',
        'Khong the tao thong bao.',
        error,
      );
    }

    const mapped = this.mapNotification(data);
    this.gateway?.emitToUser(
      input.recipientUserId,
      'notifications:new',
      mapped,
    );
    return mapped;
  }

  async createForUsers(
    recipients: string[],
    input: Omit<CreateNotificationEventDto, 'recipientUserId'>,
  ) {
    const uniqueRecipients = [...new Set(recipients)].filter(Boolean);
    const created = [];
    for (const recipientUserId of uniqueRecipients) {
      const notification = await this.createForUser({
        ...input,
        recipientUserId,
      });
      if (notification) created.push(notification);
    }
    return created;
  }

  async publishExisting(notificationId: string, recipientUserId: string) {
    const { data, error } = await this.client
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('recipient_user_id', recipientUserId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Existing notification publish failed: ${error.message}`,
      );
      return null;
    }
    if (!data) return null;

    const mapped = this.mapNotification(data);
    this.gateway?.emitToUser(recipientUserId, 'notifications:new', mapped);
    return mapped;
  }
}
