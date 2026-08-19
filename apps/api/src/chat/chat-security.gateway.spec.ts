/* eslint-disable @typescript-eslint/unbound-method */
/**
 * REAL-SERVICE WEBSOCKET & CHAT SECURITY TESTS
 *
 * Real Gateway & Real Access Service testing:
 * - Unauthenticated connection (no token)
 * - Invalid / Expired token
 * - Inactive account status (pending/rejected)
 * - Foreign chat.join (user not member of conversation)
 * - Arbitrary conversation UUID joining attempt
 * - Foreign workspace.join (user not member of project)
 * - Chat message sending without membership
 */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Socket } from 'socket.io';
import { ChatRealtimeGateway } from './chat-realtime.gateway';
import { ChatAccessService } from './chat-access.service';
import { ChatService } from './chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceRealtimeGateway } from '../workspace/workspace-realtime.gateway';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const CONVERSATION_A = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_FOREIGN = '99999999-9999-4999-8999-999999999999';
const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_FOREIGN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const USER_ID = '22222222-2222-4222-8222-222222222222';

function mockQueryChain(response: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
  };
}

function mockSocket(token?: string) {
  return {
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    data: {},
    rooms: new Set(['socket-id']),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

function makeRequestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'test@example.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Test Employee',
    avatarUrl: null,
    approvedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WebSocket & Realtime Security — Real Gateways with Supabase Mocked', () => {
  let chatGateway: ChatRealtimeGateway;
  let workspaceGateway: WorkspaceRealtimeGateway;
  let chatService: ChatService;
  let authGetUser: jest.Mock;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    authGetUser = jest.fn();
    fromMock = jest.fn();

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        auth: { getUser: authGetUser },
        from: fromMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatAccessService,
        ChatRealtimeGateway,
        WorkspaceAccessService,
        WorkspaceRealtimeGateway,
        ChatService,
        { provide: NotificationsService, useValue: { createForUser: jest.fn() } },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    chatGateway = module.get<ChatRealtimeGateway>(ChatRealtimeGateway);
    workspaceGateway = module.get<WorkspaceRealtimeGateway>(
      WorkspaceRealtimeGateway,
    );
    chatService = module.get<ChatService>(ChatService);
  });

  // =========================================================================
  // 1. Connection Authentication Tests (Chat & Workspace Gateways)
  // =========================================================================
  describe('WebSocket Gateway Connection Authentication', () => {
    it('disconnects chat socket when no auth token is provided', async () => {
      const client = mockSocket(); // No token

      await chatGateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'REALTIME_AUTH_FAILED',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.user).toBeUndefined();
    });

    it('disconnects workspace socket when no auth token is provided', async () => {
      const client = mockSocket();

      await workspaceGateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('workspace.error', {
        code: 'REALTIME_AUTH_FAILED',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects socket when JWT token is invalid or expired', async () => {
      const client = mockSocket('expired-token');
      authGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'JWT expired' },
      });

      await chatGateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'REALTIME_AUTH_FAILED',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects socket when account_status is pending or rejected (inactive account)', async () => {
      const client = mockSocket('valid-token-inactive-user');
      authGetUser.mockResolvedValueOnce({
        data: { user: { id: USER_ID, email: 'pending@example.com' } },
        error: null,
      });
      // profiles query returns account_status: 'pending'
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: USER_ID,
            email: 'pending@example.com',
            role: 'employee',
            account_status: 'pending', // Inactive!
            approved_at: null,
          },
          error: null,
        }),
      );

      await chatGateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'REALTIME_AUTH_FAILED',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.user).toBeUndefined();
    });

    it('successfully connects active user socket and attaches request user', async () => {
      const client = mockSocket('valid-token');
      authGetUser.mockResolvedValueOnce({
        data: { user: { id: USER_ID, email: 'active@example.com' } },
        error: null,
      });
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: USER_ID,
            email: 'active@example.com',
            role: 'employee',
            account_status: 'active',
            full_name: 'Active User',
            approved_at: new Date().toISOString(),
          },
          error: null,
        }),
      );

      await chatGateway.handleConnection(client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.user).toMatchObject({
        profileId: USER_ID,
        accountStatus: 'active',
      });
    });
  });

  // =========================================================================
  // 2. Chat Realtime Room Join Security (REAL ChatAccessService check)
  // =========================================================================
  describe('Chat Room Join Security with Real ChatAccessService', () => {
    it('denies join when user is NOT a member of the conversation room', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser();

      // chat_members query → returns null (not a member)
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      const result = await chatGateway.joinConversation(client, {
        conversationId: CONVERSATION_FOREIGN,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'CHAT_ACCESS_DENIED' },
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('denies join when conversationId is invalid format', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser();

      const result = await chatGateway.joinConversation(client, {
        conversationId: 'not-a-uuid',
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'CHAT_ACCESS_DENIED' },
      });
    });

    it('allows join when user IS a member with active profile in project conversation', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser();

      const membershipData = {
        id: 'member-1',
        conversation_id: CONVERSATION_A,
        user_id: USER_ID,
        conversation: {
          id: CONVERSATION_A,
          type: 'project',
          project_id: PROJECT_A,
          project: { id: PROJECT_A, client_company_id: 'comp-1' },
        },
      };

      // 1. chat_members query → found
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: membershipData, error: null }),
      );
      // 2. profiles query (getLiveProfile) → active
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: USER_ID, role: 'employee', account_status: 'active' },
          error: null,
        }),
      );
      // 3. project_memberships query (requireProjectConversationScope) → member
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: 'pm-1' }, error: null }),
      );

      const result = await chatGateway.joinConversation(client, {
        conversationId: CONVERSATION_A,
      });

      expect(result).toEqual({ ok: true, conversationId: CONVERSATION_A });
      expect(client.join).toHaveBeenCalledWith(`chat:${CONVERSATION_A}`);
    });
  });

  // =========================================================================
  // 3. Workspace Realtime Room Join Security (REAL WorkspaceAccessService)
  // =========================================================================
  describe('Workspace Room Join Security with Real WorkspaceAccessService', () => {
    it('denies workspace.join for client role', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser({ role: 'client' });

      const result = await workspaceGateway.joinProject(client, {
        projectId: PROJECT_A,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'REALTIME_ACCESS_DENIED' },
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('denies workspace.join when employee has no membership in requested project', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser({ role: 'employee' });

      // projects query → project exists
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_FOREIGN }, error: null }),
      );
      // project_memberships query → no row (not a member)
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      const result = await workspaceGateway.joinProject(client, {
        projectId: PROJECT_FOREIGN,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: 'REALTIME_ACCESS_DENIED' },
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('allows workspace.join when employee is a member of the project', async () => {
      const client = mockSocket('valid-token');
      client.data.user = makeRequestUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      const result = await workspaceGateway.joinProject(client, {
        projectId: PROJECT_A,
      });

      expect(result).toEqual({ ok: true, projectId: PROJECT_A });
      expect(client.join).toHaveBeenCalledWith(`project:${PROJECT_A}`);
    });
  });

  // =========================================================================
  // 4. Chat Message Sending Without Membership (Real ChatService)
  // =========================================================================
  describe('ChatService — Send Message Without Membership', () => {
    it('throws NotFoundException when user attempts to send message to non-member conversation', async () => {
      const user = makeRequestUser();

      // requireConversationMembership: chat_members query → returns null
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        chatService.sendMessage(
          CONVERSATION_FOREIGN,
          { content: 'Unauthorized message' },
          user,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
