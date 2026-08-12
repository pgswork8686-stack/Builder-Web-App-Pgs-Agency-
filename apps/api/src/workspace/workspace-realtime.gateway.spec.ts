/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

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
    leave: jest.fn().mockResolvedValue(undefined),
    join: jest.fn().mockResolvedValue(undefined),
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

describe('WorkspaceRealtimeGateway', () => {
  let authGetUser: jest.Mock;
  let from: jest.Mock;
  let access: { requireProjectAccess: jest.Mock };
  let gateway: WorkspaceRealtimeGateway;

  beforeEach(() => {
    authGetUser = jest.fn();
    from = jest.fn();
    access = { requireProjectAccess: jest.fn().mockResolvedValue({}) };
    gateway = new WorkspaceRealtimeGateway(
      {
        getSystemClient: () => ({ auth: { getUser: authGetUser }, from }),
      } as unknown as SupabaseService,
      access as unknown as WorkspaceAccessService,
    );
  });

  it('denies unauthenticated and invalid-token sockets', async () => {
    const missing = socket();
    await gateway.handleConnection(missing);
    expect(missing.emit).toHaveBeenCalledWith('workspace.error', {
      code: 'REALTIME_AUTH_FAILED',
    });
    expect(missing.disconnect).toHaveBeenCalledWith(true);

    const invalid = socket('invalid');
    authGetUser.mockResolvedValueOnce({ data: { user: null }, error: {} });
    await gateway.handleConnection(invalid);
    expect(invalid.disconnect).toHaveBeenCalledWith(true);
  });

  it('authenticates an active Supabase user without exposing the token', async () => {
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

  it.each(['employee', 'admin'] as const)(
    'allows authorized %s to join exactly the project room',
    async (role) => {
      const client = socket('token');
      client.data.user = requestUser(role);
      const response = await gateway.joinProject(client, {
        projectId: PROJECT_ID,
      });
      expect(response).toEqual({ ok: true, projectId: PROJECT_ID });
      expect(client.join).toHaveBeenCalledWith(`project:${PROJECT_ID}`);
    },
  );

  it('denies non-members and clients from arbitrary rooms', async () => {
    access.requireProjectAccess.mockRejectedValue(
      new ForbiddenException({ code: 'REALTIME_ACCESS_DENIED' }),
    );
    const nonMember = socket('token');
    nonMember.data.user = requestUser('employee');
    await expect(
      gateway.joinProject(nonMember, { projectId: PROJECT_ID }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'REALTIME_ACCESS_DENIED' },
    });

    const client = socket('token');
    client.data.user = requestUser('client');
    await expect(
      gateway.joinProject(client, { projectId: PROJECT_ID }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'REALTIME_ACCESS_DENIED' },
    });
  });

  it('broadcasts minimal workspace events to the authorized project room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as unknown as { server: { to: jest.Mock } }).server = { to };
    gateway.emitProjectEvent({
      projectId: PROJECT_ID,
      entityId: USER_ID,
      event: 'task.updated',
      updatedAt: '2026-08-11T10:00:00.000Z',
      changes: { status: 'done' },
    });
    expect(to).toHaveBeenCalledWith(`project:${PROJECT_ID}`);
    expect(emit).toHaveBeenCalledWith(
      'task.updated',
      expect.not.objectContaining({ token: expect.anything() }),
    );
    expect(emit).toHaveBeenCalledWith(
      'workspace.event',
      expect.objectContaining({ event: 'task.updated' }),
    );
  });
});
