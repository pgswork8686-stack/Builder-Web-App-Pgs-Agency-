import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { ChatService } from '../src/chat/chat.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ProjectsService } from '../src/projects/projects.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { SupportService } from '../src/support/support.service';
import { WorkflowRuntimeService } from '../src/workflows/workflow-runtime.service';

const CLIENT_A_USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CLIENT_A_COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_A_ID = '22222222-2222-4222-8222-222222222222';

const CLIENT_B_USER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const CLIENT_B_COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_B_ID = '44444444-4444-4444-8444-444444444444';

const WORKFLOW_ID = '55555555-5555-4555-8555-555555555555';
const APPROVAL_ID = '66666666-6666-4666-8666-666666666666';
const TICKET_ID = '77777777-7777-4777-8777-777777777777';

const CONV_PROJECT_A_ID = '88888888-8888-4888-8888-888888888888';
const CONV_PROJECT_B_ID = '99999999-9999-4999-8999-999999999999';

describe('Phase 8 Customer Portal & Multi-Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
    authUserId: CLIENT_A_USER_ID,
    profileId: CLIENT_A_USER_ID,
    email: 'clientA@client.vn',
    phone: null,
    role: 'client',
    accountStatus: 'active',
    fullName: 'Client A Representative',
    avatarUrl: null,
    approvedAt: '2026-01-01',
    departmentId: null,
  };

  const mockProjectsService = {
    getClientProjects: jest.fn().mockImplementation((userId, _page, _pageSize) => {
      if (userId === CLIENT_A_USER_ID) {
        return {
          items: [
            {
              id: PROJECT_A_ID,
              name: 'Brand Identity Project A',
              status: 'active',
              clientCompanyId: CLIENT_A_COMPANY_ID,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        };
      }
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }),
    getClientProjectById: jest.fn().mockImplementation((userId, projectId) => {
      if (userId === CLIENT_A_USER_ID) {
        if (projectId === PROJECT_A_ID) {
          return {
            id: PROJECT_A_ID,
            name: 'Brand Identity Project A',
            status: 'active',
            clientCompanyId: CLIENT_A_COMPANY_ID,
          };
        }
        // Attempting to access Project B
        throw new ForbiddenException({
          code: 'PROJECT_CLIENT_ACCESS_DENIED',
          message: 'Bạn không có quyền truy cập dự án của khách hàng khác.',
        });
      }
      return null;
    }),
  };

  const mockWorkflowRuntimeService = {
    respondApproval: jest.fn().mockImplementation((projectId, workflowId, approvalId, dto, user) => {
      if (user.profileId === CLIENT_A_USER_ID && projectId === PROJECT_B_ID) {
        throw new ForbiddenException({
          code: 'WORKFLOW_PROJECT_ACCESS_DENIED',
          message: 'Client from another company cannot respond to this approval.',
        });
      }
      return {
        id: approvalId,
        projectId,
        projectWorkflowId: workflowId,
        status: dto.decision,
        decisionNote: dto.decisionNote ?? null,
        approverUserId: user.profileId,
        respondedAt: new Date().toISOString(),
      };
    }),
  };

  const mockSupportService = {
    createTicket: jest.fn().mockImplementation((dto, user) => {
      if (user.profileId === CLIENT_A_USER_ID && dto.projectId === PROJECT_B_ID) {
        throw new ForbiddenException({
          code: 'SUPPORT_PROJECT_ACCESS_DENIED',
          message: 'Không thể tạo ticket cho dự án ngoài phạm vi hợp đồng.',
        });
      }
      return {
        id: TICKET_ID,
        clientCompanyId: CLIENT_A_COMPANY_ID,
        projectId: dto.projectId ?? PROJECT_A_ID,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        status: 'open',
        createdBy: user.profileId,
        createdAt: new Date().toISOString(),
      };
    }),
    listTickets: jest.fn().mockImplementation((_query, user) => {
      if (user.profileId === CLIENT_A_USER_ID) {
        return {
          items: [
            {
              id: TICKET_ID,
              clientCompanyId: CLIENT_A_COMPANY_ID,
              projectId: PROJECT_A_ID,
              title: 'Request font adjustment',
              status: 'open',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        };
      }
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }),
  };

  const mockNotificationsService = {
    list: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'notif-1',
          recipientUserId: CLIENT_A_USER_ID,
          type: 'workflow.approval.requested',
          title: 'Ấn phẩm mới chờ bạn duyệt',
          message: 'Giai đoạn 1 dự án Brand Identity Project A đã sẵn sàng nghiệm thu.',
          entityType: 'workflow_approval_request',
          entityId: APPROVAL_ID,
          actionUrl: '/app/client/approvals',
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  };

  const mockChatService = {
    sendMessage: jest.fn().mockImplementation((conversationId, dto, user) => {
      if (conversationId === CONV_PROJECT_B_ID) {
        throw new NotFoundException({
          code: 'CHAT_CONVERSATION_NOT_FOUND',
          message: 'Không tìm thấy cuộc trò chuyện.',
        });
      }
      return {
        id: 'msg-1',
        conversationId,
        senderId: user.profileId,
        content: dto.content,
        createdAt: new Date().toISOString(),
      };
    }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation(() => {
        const chain = {
          select: jest.fn(),
          eq: jest.fn(),
          maybeSingle: jest.fn(),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        chain.maybeSingle.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: currentUser.profileId,
              role: currentUser.role,
              account_status: currentUser.accountStatus,
              department_id: currentUser.departmentId,
            },
            error: null,
          }),
        );
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
      .overrideProvider(ProjectsService)
      .useValue(mockProjectsService)
      .overrideProvider(WorkflowRuntimeService)
      .useValue(mockWorkflowRuntimeService)
      .overrideProvider(SupportService)
      .useValue(mockSupportService)
      .overrideProvider(NotificationsService)
      .useValue(mockNotificationsService)
      .overrideProvider(ChatService)
      .useValue(mockChatService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = () => ({ Authorization: 'Bearer valid-e2e-token' });

  // 1. Client Login & View Own Projects
  it('1. Client A logs in and retrieves only their own company projects', async () => {
    currentUser = {
      authUserId: CLIENT_A_USER_ID,
      profileId: CLIENT_A_USER_ID,
      email: 'clientA@client.vn',
      phone: null,
      role: 'client',
      accountStatus: 'active',
      fullName: 'Client A Representative',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: null,
    };

    const res = await request(app.getHttpServer())
      .get('/api/v1/client/me/projects')
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toHaveProperty('id', PROJECT_A_ID);
    expect(res.body.items[0]).toHaveProperty('clientCompanyId', CLIENT_A_COMPANY_ID);
  });

  // 2. Client Tenancy Isolation: Client A CANNOT view Client B project
  it('2. Client A is denied access (HTTP 403) when attempting to view Client B project', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/client/me/projects/${PROJECT_B_ID}`)
      .set(authHeader())
      .expect(403);
  });

  // 3. Client Deliverable Approval Flow: Approve
  it('3. Client A approves deliverable stage item', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_A_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authHeader())
      .send({
        decision: 'approved',
        decisionNote: 'Ấn phẩm thiết kế đạt chất lượng nghiệm thu.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('status', 'approved');
  });

  // 4. Client Deliverable Approval Flow: Request Revision
  it('4. Client A requests revision on deliverable', async () => {
    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_A_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authHeader())
      .send({
        decision: 'rejected',
        decisionNote: 'Cần chỉnh sửa lại font chữ logo và tăng tương phản màu.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('status', 'rejected');
    expect(res.body).toHaveProperty('decisionNote', 'Cần chỉnh sửa lại font chữ logo và tăng tương phản màu.');
  });

  // 5. Client Support Ticket: Create & Query
  it('5. Client A creates a support ticket for their project', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/support/tickets')
      .set(authHeader())
      .send({
        projectId: PROJECT_A_ID,
        title: 'Yêu cầu hỗ trợ xuất file vector SVG',
        description: 'Vui lòng cung cấp thêm định dạng SVG cho ấn phẩm số 2.',
        priority: 'medium',
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('id', TICKET_ID);
    expect(createRes.body).toHaveProperty('status', 'open');

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/support/tickets')
      .set(authHeader())
      .expect(200);

    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0]).toHaveProperty('projectId', PROJECT_A_ID);
  });

  // 6. Client Notifications: Receive project & approval notifications
  it('6. Client A receives relevant approval notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toHaveProperty('type', 'workflow.approval.requested');
  });

  // 7. Client Chat: Chat within project conversation only
  it('7. Client A can chat in Project A conversation and is denied Project B conversation', async () => {
    // Project A chat -> PASS
    const chatRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${CONV_PROJECT_A_ID}/messages`)
      .set(authHeader())
      .send({ content: 'Chào PM, bản thiết kế mới đã được duyệt!' })
      .expect(201);

    expect(chatRes.body).toHaveProperty('content', 'Chào PM, bản thiết kế mới đã được duyệt!');

    // Project B chat -> 404
    await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${CONV_PROJECT_B_ID}/messages`)
      .set(authHeader())
      .send({ content: 'Tin nhắn trái phép tới dự án B' })
      .expect(404);
  });
});
