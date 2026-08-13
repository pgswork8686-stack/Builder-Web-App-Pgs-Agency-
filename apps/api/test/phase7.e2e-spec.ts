import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AutomationService } from '../src/automation/automation.service';
import type { AppRole } from '../src/auth/auth.types';
import { ChatService } from '../src/chat/chat.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '22222222-2222-4222-8222-222222222222';

describe('Phase 7 notifications chat automation API (e2e)', () => {
  let app: INestApplication;
  let currentRole: AppRole = 'admin';

  const notificationsService = {
    list: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    unreadCount: jest.fn().mockResolvedValue({ unreadCount: 0 }),
    markRead: jest.fn().mockResolvedValue({ id: USER_ID }),
    markAllRead: jest.fn().mockResolvedValue({ updated: 0 }),
    getPreferences: jest.fn().mockResolvedValue({
      userId: USER_ID,
      inAppEnabled: true,
      emailEnabled: false,
      preferences: {},
    }),
    updatePreferences: jest.fn().mockResolvedValue({
      userId: USER_ID,
      inAppEnabled: true,
      emailEnabled: false,
      preferences: {},
    }),
  };

  const chatService = {
    listConversations: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    unreadCount: jest.fn().mockResolvedValue({ unreadCount: 0 }),
    createDirectConversation: jest
      .fn()
      .mockResolvedValue({ id: CONVERSATION_ID }),
    getOrCreateProjectConversation: jest
      .fn()
      .mockResolvedValue({ id: CONVERSATION_ID }),
    getConversationById: jest.fn().mockResolvedValue({ id: CONVERSATION_ID }),
    listMessages: jest.fn().mockResolvedValue({ items: [], nextBefore: null }),
    sendMessage: jest.fn().mockResolvedValue({ id: 'message-id' }),
    markRead: jest.fn().mockResolvedValue({ conversationId: CONVERSATION_ID }),
  };

  const automationService = {
    listRules: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    createRule: jest.fn().mockResolvedValue({ id: 'rule-id' }),
    updateRule: jest.fn().mockResolvedValue({ id: 'rule-id' }),
    listExecutions: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    runManualEvent: jest.fn().mockResolvedValue({ matchedRules: 0 }),
    runScheduled: jest.fn().mockResolvedValue({ businessDate: '2026-08-13' }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: USER_ID, email: 'phase7@example.com' } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation(() => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn().mockResolvedValue({
          data: {
            id: USER_ID,
            role: currentRole,
            account_status: 'active',
          },
          error: null,
        });
        return chain;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: () => authClient,
        createUserClient: () => authClient,
      })
      .overrideProvider(NotificationsService)
      .useValue(notificationsService)
      .overrideProvider(ChatService)
      .useValue(chatService)
      .overrideProvider(AutomationService)
      .useValue(automationService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    currentRole = 'admin';
    jest.clearAllMocks();
  });

  afterAll(async () => app.close());

  const authorized = () => ({ Authorization: 'Bearer phase-7-token' });

  it('requires authentication for Phase 7 endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .expect(401);
  });

  it('allows active users to read only their notification surfaces', async () => {
    currentRole = 'client';
    await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(authorized())
      .expect(200)
      .expect(({ body }) => expect(body.unreadCount).toBe(0));

    expect(notificationsService.unreadCount).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: USER_ID, role: 'client' }),
    );
  });

  it('rejects invalid notification preference patches before service call', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set(authorized())
      .send({})
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('PATCH_EMPTY'));

    expect(notificationsService.updatePreferences).not.toHaveBeenCalled();
  });

  it('keeps automation management admin-only', async () => {
    currentRole = 'employee';
    await request(app.getHttpServer())
      .get('/api/v1/automation/rules')
      .set(authorized())
      .expect(403);

    currentRole = 'admin';
    await request(app.getHttpServer())
      .get('/api/v1/automation/rules')
      .set(authorized())
      .expect(200);
  });

  it('rejects unsafe automation action types', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/automation/rules')
      .set(authorized())
      .send({
        name: 'Unsafe webhook',
        triggerType: 'task.created',
        actionType: 'webhook',
        actionConfig: {},
      })
      .expect(400);
  });

  it('validates chat pagination and message content', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages?limit=101`)
      .set(authorized())
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${CONVERSATION_ID}/messages`)
      .set(authorized())
      .send({ content: '   ' })
      .expect(400);
  });
});
