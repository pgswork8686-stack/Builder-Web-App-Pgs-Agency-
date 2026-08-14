/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { ChatAccessService } from './chat-access.service';
import { ChatRealtimeGateway } from './chat-realtime.gateway';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const REVOKED_USER_ID = '33333333-3333-4333-8333-333333333333';

function profileQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq']) chain[method] = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data, error });
  return chain;
}

function socket(token?: string) {
  return {
    handshake: { auth: token ? { token } : {}, headers: {} },
    emit: jest.fn(),
    disconnect: jest.fn(),
    data: {},
    rooms: new Set(['socket-id']),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

function requestUser(role: RequestUser['role'] = 'employee'): RequestUser {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'member@example.com',
    phone: null,
    accountStatus: 'active',
    role,
    fullName: 'Member',
    avatarUrl: null,
    approvedAt: null,
  };
}

describe('ChatRealtimeGateway', () => {
  let authGetUser: jest.Mock;
  let from: jest.Mock;
  let access: { requireConversationMembership: jest.Mock };
  let gateway: ChatRealtimeGateway;

  beforeEach(() => {
    authGetUser = jest.fn();
    from = jest.fn();
    access = { requireConversationMembership: jest.fn().mockResolvedValue({}) };
    gateway = new ChatRealtimeGateway(
      {
        getSystemClient: () => ({ auth: { getUser: authGetUser }, from }),
      } as unknown as SupabaseService,
      access as unknown as ChatAccessService,
    );
  });

  it('denies unauthenticated and invalid-token sockets', async () => {
    const missing = socket();
    await gateway.handleConnection(missing);
    expect(missing.emit).toHaveBeenCalledWith('chat.error', {
      code: 'REALTIME_AUTH_FAILED',
    });
    expect(missing.disconnect).toHaveBeenCalledWith(true);

    const invalid = socket('invalid');
    authGetUser.mockResolvedValueOnce({ data: { user: null }, error: {} });
    await gateway.handleConnection(invalid);
    expect(invalid.disconnect).toHaveBeenCalledWith(true);
  });

  it('authenticates an active Supabase user without storing the token', async () => {
    authGetUser.mockResolvedValueOnce({
      data: { user: { id: USER_ID, email: 'member@example.com' } },
      error: null,
    });
    from.mockReturnValueOnce(
      profileQuery({
        id: USER_ID,
        role: 'employee',
        account_status: 'active',
      }),
    );
    const client = socket('valid-token');
    await gateway.handleConnection(client);
    expect(client.data.user).toMatchObject({ profileId: USER_ID });
    expect(client.data).not.toHaveProperty('token');
  });

  it('allows only members to join a conversation room', async () => {
    const client = socket('token');
    client.data.user = requestUser('employee');
    client.rooms.add('chat:old-conversation');

    await expect(
      gateway.joinConversation(client, { conversationId: CONVERSATION_ID }),
    ).resolves.toEqual({ ok: true, conversationId: CONVERSATION_ID });
    expect(access.requireConversationMembership).toHaveBeenCalledWith(
      CONVERSATION_ID,
      expect.objectContaining({ profileId: USER_ID }),
    );
    expect(client.join).toHaveBeenCalledWith(`chat:${CONVERSATION_ID}`);
    expect(client.leave).toHaveBeenCalledWith('chat:old-conversation');
  });

  it('denies arbitrary room joins for non-members', async () => {
    access.requireConversationMembership.mockRejectedValue(
      new ForbiddenException({ code: 'CHAT_ACCESS_DENIED' }),
    );
    const client = socket('token');
    client.data.user = requestUser('client');

    await expect(
      gateway.joinConversation(client, { conversationId: CONVERSATION_ID }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'CHAT_ACCESS_DENIED' },
    });
  });

  it('evicts a revoked member before broadcasting to a stale room', async () => {
    const authorizedSocket = {
      data: { user: requestUser() },
      emit: jest.fn(),
      leave: jest.fn().mockResolvedValue(undefined),
    };
    const revokedSocket = {
      data: {
        user: { ...requestUser(), profileId: REVOKED_USER_ID },
      },
      emit: jest.fn(),
      leave: jest.fn().mockResolvedValue(undefined),
    };
    const fetchSockets = jest
      .fn()
      .mockResolvedValue([authorizedSocket, revokedSocket]);
    const server = {
      in: jest.fn(() => ({ fetchSockets })),
    };
    (gateway as unknown as { server: unknown }).server = server;
    access.requireConversationMembership.mockImplementation(
      (_conversationId: string, candidate: RequestUser) => {
        if (candidate.profileId === REVOKED_USER_ID) {
          return Promise.reject(new ForbiddenException());
        }
        return Promise.resolve({});
      },
    );

    await gateway.emitConversation(CONVERSATION_ID, 'chat:message:new', {
      id: 'message-id',
    });

    expect(revokedSocket.emit).toHaveBeenCalledWith('chat.error', {
      code: 'CHAT_ACCESS_DENIED',
    });
    expect(revokedSocket.leave).toHaveBeenCalledWith(`chat:${CONVERSATION_ID}`);
    expect(authorizedSocket.leave).not.toHaveBeenCalled();
    expect(authorizedSocket.emit).toHaveBeenCalledWith('chat:message:new', {
      id: 'message-id',
    });
    expect(revokedSocket.emit).not.toHaveBeenCalledWith('chat:message:new', {
      id: 'message-id',
    });
  });
});
