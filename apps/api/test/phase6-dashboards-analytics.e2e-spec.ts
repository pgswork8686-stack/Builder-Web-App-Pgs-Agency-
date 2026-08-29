import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { AttendanceService } from '../src/attendance/attendance.service';
import { FinanceService } from '../src/finance/finance.service';
import { ProjectsService } from '../src/projects/projects.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { TasksService } from '../src/tasks/tasks.service';
import { WorkflowRuntimeService } from '../src/workflows/workflow-runtime.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const DEPT_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

describe('Phase 6 Dashboards, Reporting & Analytics (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
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

  const mockProjectsService = {
    getAdminProjects: jest.fn().mockResolvedValue({
      items: [
        {
          id: PROJECT_ID,
          name: 'Marketing Campaign 2026',
          status: 'active',
          departmentId: DEPT_ID,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    getInternalProjects: jest.fn().mockResolvedValue({
      items: [
        {
          id: PROJECT_ID,
          name: 'Marketing Campaign 2026',
          status: 'active',
          departmentId: DEPT_ID,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  };

  const mockTasksService = {
    getTasks: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'task-1',
          title: 'Design banner',
          status: 'in_progress',
          priority: 'high',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  };

  const mockAttendanceService = {
    getSummary: jest.fn().mockResolvedValue({
      present: 20,
      late: 2,
      early_leave: 1,
      absent: 1,
      total_work_days: 22,
    }),
    getMyHistory: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'att-1',
          attendanceDate: '2026-08-26',
          status: 'present',
        },
      ],
      total: 1,
    }),
  };

  const mockFinanceService = {
    getSummary: jest.fn().mockResolvedValue({
      total_revenue_ytd: 500000000,
      total_expenses_ytd: 200000000,
      net_profit_ytd: 300000000,
    }),
  };

  const mockWorkflowRuntimeService = {
    listApprovals: jest.fn().mockResolvedValue([
      {
        id: 'app-1',
        projectId: PROJECT_ID,
        approvalType: 'internal',
        status: 'pending',
      },
    ]),
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
      .overrideProvider(TasksService)
      .useValue(mockTasksService)
      .overrideProvider(AttendanceService)
      .useValue(mockAttendanceService)
      .overrideProvider(FinanceService)
      .useValue(mockFinanceService)
      .overrideProvider(WorkflowRuntimeService)
      .useValue(mockWorkflowRuntimeService)
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

  // 1. Health endpoint for Admin Dashboard
  it('1. System health check endpoint responds with 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
  });

  // 2. Admin Dashboard: Projects & Financial Summary Metrics
  it('2. Admin Dashboard aggregates projects & financial summary metrics', async () => {
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

    const projRes = await request(app.getHttpServer())
      .get('/api/v1/admin/projects')
      .set(authHeader())
      .expect(200);

    expect(projRes.body.items).toHaveLength(1);

    const finRes = await request(app.getHttpServer())
      .get('/api/v1/finance/summary')
      .set(authHeader())
      .expect(200);

    expect(finRes.body).toHaveProperty('total_revenue_ytd', 500000000);
  });

  // 3. Manager Dashboard: Department Projects & Open Tasks
  it('3. Manager Dashboard queries department scoped projects and tasks', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@pgs.vn',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager User',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const projRes = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set(authHeader())
      .expect(200);

    expect(projRes.body.items).toHaveLength(1);

    const taskRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks`)
      .set(authHeader())
      .expect(200);

    expect(taskRes.body.items).toHaveLength(1);
    expect(taskRes.body.items[0]).toHaveProperty('status', 'in_progress');
  });

  // 4. Employee Dashboard: Personal Attendance & Tasks
  it('4. Employee Dashboard queries personal attendance and assigned workload', async () => {
    currentUser = {
      authUserId: USER_ID,
      profileId: USER_ID,
      email: 'emp@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee User',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const attRes = await request(app.getHttpServer())
      .get('/api/v1/attendance/me')
      .set(authHeader())
      .expect(200);

    expect(attRes.body.items).toHaveLength(1);

    const taskRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks?assigneeUserId=${USER_ID}`)
      .set(authHeader())
      .expect(200);

    expect(taskRes.body.items).toHaveLength(1);
  });

  // 5. Attendance Analytics Summary
  it('5. Attendance Analytics Summary returns aggregated stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance/summary')
      .set(authHeader())
      .expect(200);

    expect(res.body).toHaveProperty('present', 20);
    expect(res.body).toHaveProperty('late', 2);
    expect(res.body).toHaveProperty('total_work_days', 22);
  });
});
