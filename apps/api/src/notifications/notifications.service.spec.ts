import type { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from './notifications.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';

function user() {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'user@example.com',
    phone: null,
    accountStatus: 'active' as const,
    role: 'employee' as const,
    fullName: 'User',
    avatarUrl: null,
    approvedAt: null,
  };
}

function query(result: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'eq',
    'is',
    'order',
    'range',
    'update',
    'insert',
    'upsert',
    'single',
    'maybeSingle',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.range = jest.fn().mockResolvedValue({
    data: [],
    count: 0,
    error: null,
    ...result,
  });
  chain.single = jest.fn().mockResolvedValue({
    data: null,
    error: null,
    ...result,
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: null,
    error: null,
    ...result,
  });
  return chain;
}

describe('NotificationsService', () => {
  let from: jest.Mock;
  let service: NotificationsService;
  const gateway = { emitToUser: jest.fn() };

  beforeEach(() => {
    from = jest.fn();
    service = new NotificationsService(
      {
        getSystemClient: () => ({ from }),
      } as unknown as SupabaseService,
      gateway as any,
    );
    jest.clearAllMocks();
  });

  it('lists only the current user notifications with DB pagination', async () => {
    const listQuery = query({
      data: [{ id: NOTIFICATION_ID, recipient_user_id: USER_ID }],
      count: 1,
    });
    from.mockReturnValueOnce(listQuery);

    const result = await service.list(
      { page: 2, pageSize: 10, unreadOnly: false },
      user(),
    );

    expect(from).toHaveBeenCalledWith('notifications');
    expect(listQuery.eq).toHaveBeenCalledWith('recipient_user_id', USER_ID);
    expect(listQuery.range).toHaveBeenCalledWith(10, 19);
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 });
  });

  it('marks a notification read only when it belongs to the current user', async () => {
    const readQuery = query({
      data: {
        id: NOTIFICATION_ID,
        recipient_user_id: USER_ID,
        read_at: '2026-08-13T00:00:00.000Z',
        created_at: '2026-08-13T00:00:00.000Z',
      },
    });
    from.mockReturnValueOnce(readQuery);

    await service.markRead(NOTIFICATION_ID, user());

    expect(readQuery.eq).toHaveBeenCalledWith('id', NOTIFICATION_ID);
    expect(readQuery.eq).toHaveBeenCalledWith('recipient_user_id', USER_ID);
    expect(readQuery.is).toHaveBeenCalledWith('read_at', null);
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      USER_ID,
      'notifications:read',
      expect.objectContaining({ id: NOTIFICATION_ID }),
    );
  });

  it('returns an already-read notification without changing it or emitting again', async () => {
    const updateQuery = query({ data: null });
    const existingQuery = query({
      data: {
        id: NOTIFICATION_ID,
        recipient_user_id: USER_ID,
        read_at: '2026-08-13T00:00:00.000Z',
        created_at: '2026-08-13T00:00:00.000Z',
      },
    });
    from.mockReturnValueOnce(updateQuery).mockReturnValueOnce(existingQuery);

    const result = await service.markRead(NOTIFICATION_ID, user());

    expect(updateQuery.is).toHaveBeenCalledWith('read_at', null);
    expect(existingQuery.eq).toHaveBeenCalledWith('id', NOTIFICATION_ID);
    expect(existingQuery.eq).toHaveBeenCalledWith(
      'recipient_user_id',
      USER_ID,
    );
    expect(result.readAt).toBe('2026-08-13T00:00:00.000Z');
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('updates only supplied preference booleans', async () => {
    const preferencesQuery = query({
      data: {
        user_id: USER_ID,
        in_app_enabled: false,
        email_enabled: true,
        preferences: {},
        updated_at: '2026-08-13T00:00:00.000Z',
      },
    });
    from.mockReturnValueOnce(preferencesQuery);

    await service.updatePreferences({ emailEnabled: true }, user());

    expect(preferencesQuery.upsert).toHaveBeenCalledWith(
      {
        user_id: USER_ID,
        email_enabled: true,
        updated_by: USER_ID,
      },
      { onConflict: 'user_id' },
    );
  });

  it('does not notify the actor about their own action', async () => {
    await expect(
      service.createForUser({
        recipientUserId: USER_ID,
        actorUserId: USER_ID,
        type: 'task.assigned',
        title: 'Task',
        message: 'Task',
      }),
    ).resolves.toBeNull();

    expect(from).not.toHaveBeenCalled();
  });
});
