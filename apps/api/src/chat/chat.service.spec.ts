import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { ChatAccessService } from './chat-access.service';
import { ChatService } from './chat.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PEER_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444';

function user(role: RequestUser['role'] = 'employee'): RequestUser {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'user@example.com',
    phone: null,
    accountStatus: 'active',
    role,
    fullName: 'User',
    avatarUrl: null,
    approvedAt: null,
  };
}

function query(result: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> & {
    then?: (callback: (value: unknown) => unknown) => unknown;
  } = {};
  for (const method of [
    'select',
    'eq',
    'lt',
    'order',
    'limit',
    'insert',
    'single',
    'maybeSingle',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  const resolved = {
    data: [],
    count: 0,
    error: null,
    ...result,
  };
  chain.limit = jest.fn().mockResolvedValue(resolved);
  chain.single = jest.fn().mockResolvedValue(resolved);
  chain.maybeSingle = jest.fn().mockResolvedValue(resolved);
  chain.then = (callback) => Promise.resolve(callback(resolved));
  return chain;
}

describe('ChatService', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let access: { requireConversationMembership: jest.Mock };
  let notifications: { createForUsers: jest.Mock };
  let realtime: { emitConversation: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    access = { requireConversationMembership: jest.fn().mockResolvedValue({}) };
    notifications = { createForUsers: jest.fn().mockResolvedValue([]) };
    realtime = { emitConversation: jest.fn() };
    service = new ChatService(
      { getSystemClient: () => ({ from, rpc }) } as unknown as SupabaseService,
      access as unknown as ChatAccessService,
      notifications as unknown as NotificationsService,
      undefined,
      realtime as any,
    );
  });

  it('denies client direct chat before any database RPC', async () => {
    await expect(
      service.createDirectConversation({ peerUserId: PEER_ID }, user('client')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires membership and uses cursor pagination for chat history', async () => {
    const historyQuery = query({
      data: [
        {
          id: 'newer',
          conversation_id: CONVERSATION_ID,
          sender_user_id: USER_ID,
          content: 'newer',
          created_at: '2026-08-13T10:00:00.000Z',
        },
        {
          id: 'older',
          conversation_id: CONVERSATION_ID,
          sender_user_id: PEER_ID,
          content: 'older',
          created_at: '2026-08-13T09:00:00.000Z',
        },
      ],
    });
    from.mockReturnValueOnce(historyQuery);

    const result = await service.listMessages(
      CONVERSATION_ID,
      { limit: 2, before: '2026-08-13T11:00:00.000Z' },
      user(),
    );

    expect(access.requireConversationMembership).toHaveBeenCalledWith(
      CONVERSATION_ID,
      expect.objectContaining({ profileId: USER_ID }),
    );
    expect(historyQuery.lt).toHaveBeenCalledWith(
      'created_at',
      '2026-08-13T11:00:00.000Z',
    );
    expect(result.items.map((item) => item.id)).toEqual(['older', 'newer']);
    expect(result.nextBefore).toBe('2026-08-13T09:00:00.000Z');
  });

  it('persists before emitting and notifying other members', async () => {
    const messageQuery = query({
      data: {
        id: MESSAGE_ID,
        conversation_id: CONVERSATION_ID,
        sender_user_id: USER_ID,
        content: 'hello',
        created_at: '2026-08-13T10:00:00.000Z',
      },
    });
    const membersQuery = query({
      data: [{ user_id: USER_ID }, { user_id: PEER_ID }],
    });
    from.mockReturnValueOnce(messageQuery).mockReturnValueOnce(membersQuery);

    const result = await service.sendMessage(
      CONVERSATION_ID,
      { content: ' hello ' },
      user(),
    );

    expect(result).toMatchObject({ id: MESSAGE_ID, content: 'hello' });
    expect(realtime.emitConversation).toHaveBeenCalledWith(
      CONVERSATION_ID,
      'chat:message:new',
      expect.objectContaining({ id: MESSAGE_ID }),
    );
    expect(notifications.createForUsers).toHaveBeenCalledWith(
      [PEER_ID],
      expect.objectContaining({
        type: 'chat.message',
        actorUserId: USER_ID,
      }),
    );
  });
});
