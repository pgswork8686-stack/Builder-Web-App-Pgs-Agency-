import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const NOTIFICATION_ID = '11111111-1111-4111-8111-111111111111';

describe('Phase 7 Notification & Communication Center (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'user@pgs.vn',
    phone: null,
    role: 'employee',
    accountStatus: 'active',
    fullName: 'Employee Test',
    avatarUrl: null,
    approvedAt: '2026-01-01',
    departmentId: null,
  };

  const sampleNotifications = [
    {
      id: NOTIFICATION_ID,
      recipientUserId: USER_ID,
      type: 'task.assigned',
      title: 'Công việc mới được giao',
      message: 'Bạn được phân công làm task: Thiết kế banner',
      entityType: 'task',
      entityId: 'task-123',
      actionUrl: '/app/employee/tasks',
      metadata: {},
      readAt: null,
      createdAt: '2026-08-26T08:00:00Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      recipientUserId: USER_ID,
      type: 'workflow.approval.requested',
      title: 'Yêu cầu duyệt ấn phẩm',
      message: 'Giai đoạn 1 dự án PGS Web đang chờ bạn phê duyệt.',
      entityType: 'workflow_approval_request',
      entityId: 'approval-123',
      actionUrl: '/app/team-leader/approvals',
      metadata: {},
      readAt: null,
      createdAt: '2026-08-26T08:30:00Z',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      recipientUserId: USER_ID,
      type: 'workflow.approval.approved',
      title: 'Ấn phẩm đã được duyệt',
      message: 'Client đã chấp thuận bàn giao thiết kế.',
      entityType: 'workflow_approval_request',
      entityId: 'approval-123',
      actionUrl: '/app/projects/123',
      metadata: {},
      readAt: '2026-08-26T09:00:00Z',
      createdAt: '2026-08-26T08:45:00Z',
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      recipientUserId: USER_ID,
      type: 'attendance.abnormal',
      title: 'Cảnh báo chấm công bất thường',
      message: 'Hệ thống ghi nhận bạn chưa check-out ngày hôm qua.',
      entityType: 'attendance_record',
      entityId: 'att-123',
      actionUrl: '/app/attendance',
      metadata: {},
      readAt: null,
      createdAt: '2026-08-26T09:15:00Z',
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      recipientUserId: USER_ID,
      type: 'leave.requested',
      title: 'Đơn xin nghỉ phép mới',
      message: 'Nhân viên A vừa gửi đơn xin nghỉ phép 1 ngày.',
      entityType: 'leave_request',
      entityId: 'leave-123',
      actionUrl: '/app/team-leader/approvals',
      metadata: {},
      readAt: null,
      createdAt: '2026-08-26T09:30:00Z',
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      recipientUserId: USER_ID,
      type: 'project.status_changed',
      title: 'Cập nhật trạng thái dự án',
      message: 'Dự án PGS Web App đã chuyển sang trạng thái Hoàn thành.',
      entityType: 'project',
      entityId: 'proj-123',
      actionUrl: '/app/projects/proj-123',
      metadata: {},
      readAt: null,
      createdAt: '2026-08-26T10:00:00Z',
    },
  ];

  const mockNotificationsService = {
    list: jest.fn().mockImplementation((query) => {
      let filtered = [...sampleNotifications];
      if (query?.unreadOnly) {
        filtered = filtered.filter((n) => n.readAt === null);
      }
      return {
        items: filtered,
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 20,
        total: filtered.length,
        totalPages: 1,
      };
    }),
    unreadCount: jest.fn().mockResolvedValue({
      unreadCount: sampleNotifications.filter((n) => n.readAt === null).length,
    }),
    markRead: jest.fn().mockImplementation((id) => {
      const target = sampleNotifications.find((n) => n.id === id);
      return {
        ...(target || sampleNotifications[0]),
        readAt: new Date().toISOString(),
      };
    }),
    markAllRead: jest.fn().mockResolvedValue({
      updated: 5,
    }),
    getPreferences: jest.fn().mockResolvedValue({
      userId: USER_ID,
      inAppEnabled: true,
      emailEnabled: false,
      preferences: {},
      updatedAt: '2026-08-26T00:00:00Z',
    }),
    updatePreferences: jest.fn().mockImplementation((dto) => ({
      userId: USER_ID,
      inAppEnabled: dto.inAppEnabled ?? true,
      emailEnabled: dto.emailEnabled ?? false,
      preferences: {},
      updatedAt: new Date().toISOString(),
    })),
    broadcastToAll: jest.fn().mockResolvedValue({
      success: true,
      count: 10,
      delivered: 10,
      message: 'Đã phát thông báo thành công đến toàn thể 10 thành viên!',
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
      .overrideProvider(NotificationsService)
      .useValue(mockNotificationsService)
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

  // 1. Notification Center: Lists all core ERP triggers
  it('1. Notification Center retrieves notifications across task, approval, attendance, leave, project', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(6);
    const types = res.body.items.map((i: any) => i.type);
    expect(types).toContain('task.assigned');
    expect(types).toContain('workflow.approval.requested');
    expect(types).toContain('workflow.approval.approved');
    expect(types).toContain('attendance.abnormal');
    expect(types).toContain('leave.requested');
    expect(types).toContain('project.status_changed');
  });

  // 2. Notification Lifecycle: Unread count & Unread filter
  it('2. Notification lifecycle: Query unread notifications and fast unread counter', async () => {
    const countRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(authHeader())
      .expect(200);

    expect(countRes.body).toHaveProperty('unreadCount', 5);

    const unreadRes = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set(authHeader())
      .expect(200);

    expect(unreadRes.body.items).toHaveLength(5);
  });

  // 3. Notification Lifecycle: Mark individual notification as read
  it('3. Notification lifecycle: Mark single notification as read', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${NOTIFICATION_ID}/read`)
      .set(authHeader())
      .expect(200);

    expect(res.body).toHaveProperty('id', NOTIFICATION_ID);
    expect(res.body.readAt).not.toBeNull();
  });

  // 4. Notification Lifecycle: Mark all as read (Archive/Bulk read)
  it('4. Notification lifecycle: Mark all notifications as read in bulk', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set(authHeader())
      .expect(201);

    expect(res.body).toHaveProperty('updated', 5);
  });

  // 5. Notification Preferences (In-app vs Email)
  it('5. User manages in-app and email notification preferences', async () => {
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set(authHeader())
      .expect(200);

    expect(getRes.body).toHaveProperty('inAppEnabled', true);

    const patchRes = await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set(authHeader())
      .send({ inAppEnabled: false, emailEnabled: true })
      .expect(200);

    expect(patchRes.body).toHaveProperty('inAppEnabled', false);
    expect(patchRes.body).toHaveProperty('emailEnabled', true);
  });

  // 6. Admin Broadcast to All Employees
  it('6. Admin broadcasts notification to all company members', async () => {
    currentUser = {
      authUserId: 'admin-id',
      profileId: 'admin-id',
      email: 'admin@pgs.vn',
      phone: null,
      role: 'admin',
      accountStatus: 'active',
      fullName: 'Admin User',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: null,
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/broadcast')
      .set(authHeader())
      .send({
        title: 'Thông báo nghỉ lễ Quốc Khánh',
        message: 'Công ty nghỉ lễ từ ngày 01/09 đến hết ngày 03/09.',
        type: 'announcement',
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('delivered', 10);
  });
});
