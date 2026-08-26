import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { ProjectsService } from '../src/projects/projects.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { TasksService } from '../src/tasks/tasks.service';
import { WorkspaceService } from '../src/workspace/workspace.service';

const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const TASK_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const DEPT_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

describe('Phase 3.5 Operational Business Scenario Validation (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
    authUserId: 'user-admin',
    profileId: 'user-admin',
    email: 'admin@example.com',
    phone: null,
    role: 'admin',
    accountStatus: 'active',
    fullName: 'Admin User',
    avatarUrl: null,
    approvedAt: '2026-01-01',
    departmentId: null,
  };

  const mockProjectsService = {
    createProject: jest
      .fn()
      .mockImplementation((dto, actorId, role, deptId) => ({
        id: PROJECT_ID,
        ...dto,
        departmentId: role === 'team_leader' ? deptId : dto.departmentId,
        createdBy: actorId,
      })),
    getInternalProjects: jest.fn().mockResolvedValue({
      items: [{ id: PROJECT_ID, name: 'Project 3.5 Scenario' }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    getInternalProjectById: jest.fn().mockResolvedValue({
      id: PROJECT_ID,
      name: 'Project 3.5 Scenario',
    }),
    getClientProjects: jest.fn().mockResolvedValue({
      items: [{ id: PROJECT_ID, name: 'Project 3.5 Scenario' }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    getClientProjectById: jest.fn().mockResolvedValue({
      id: PROJECT_ID,
      name: 'Project 3.5 Scenario',
    }),
  };

  const mockTasksService = {
    createTask: jest.fn().mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      title: 'Setup Environment',
      status: 'todo',
    }),
    getTasks: jest.fn().mockResolvedValue({
      items: [
        {
          id: TASK_ID,
          title: 'Setup Environment',
          status: 'todo',
          canUpdateStatus: true,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    updateTask: jest.fn().mockResolvedValue({
      id: TASK_ID,
      status: 'in_progress',
    }),
  };

  const mockWorkspaceService = {
    getBoard: jest.fn().mockResolvedValue({
      todo: [],
      inProgress: [
        { id: TASK_ID, title: 'Setup Environment', status: 'in_progress' },
      ],
      review: [],
      done: [],
      canReorder: true,
      total: 1,
    }),
    getCalendar: jest.fn().mockResolvedValue([
      {
        taskId: TASK_ID,
        title: 'Setup Environment',
        startDate: '2026-08-26',
        dueDate: '2026-08-30',
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
      .overrideProvider(WorkspaceService)
      .useValue(mockWorkspaceService)
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

  // SCENARIO 1: Manager tạo Project thuộc Department
  it('Scenario 1: Manager creates Project within own department scope', async () => {
    currentUser = {
      authUserId: 'mgr-1',
      profileId: 'mgr-1',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Dept Web',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/projects')
      .set(authHeader())
      .send({
        clientCompanyId: '22222222-2222-4222-8222-222222222222',
        name: 'Web Portal Project',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id', PROJECT_ID);
    expect(mockProjectsService.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Web Portal Project' }),
      'mgr-1',
      'team_leader',
      DEPT_ID,
    );
  });

  // SCENARIO 2: Manager tạo Task trong Project
  it('Scenario 2: Manager creates Task and assigns to Employee', async () => {
    currentUser = {
      authUserId: '11111111-1111-4111-8111-111111111111',
      profileId: '11111111-1111-4111-8111-111111111111',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Dept Web',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/tasks`)
      .set(authHeader())
      .send({
        title: 'Setup Database',
        assigneeUserId: '22222222-2222-4222-8222-222222222222',
      })
      .expect(201);

    expect(mockTasksService.createTask).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        title: 'Setup Database',
        assigneeUserId: '22222222-2222-4222-8222-222222222222',
      }),
      expect.objectContaining({
        profileId: '11111111-1111-4111-8111-111111111111',
      }),
    );
  });

  // SCENARIO 3: Employee xem Task được giao và cập nhật trạng thái
  it('Scenario 3: Employee views assigned task and updates status to in_progress', async () => {
    currentUser = {
      authUserId: '22222222-2222-4222-8222-222222222222',
      profileId: '22222222-2222-4222-8222-222222222222',
      email: 'employee@example.com',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee 1',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks`)
      .set(authHeader())
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}`)
      .set(authHeader())
      .send({ status: 'in_progress' })
      .expect(200);

    expect(mockTasksService.updateTask).toHaveBeenCalledWith(
      PROJECT_ID,
      TASK_ID,
      { status: 'in_progress' },
      expect.objectContaining({
        profileId: '22222222-2222-4222-8222-222222222222',
        role: 'employee',
      }),
    );
  });

  // SCENARIO 4: Manager xem Kanban Board đồng bộ
  it('Scenario 4: Manager views updated Kanban board', async () => {
    currentUser = {
      authUserId: 'mgr-1',
      profileId: 'mgr-1',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Dept Web',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/board`)
      .set(authHeader())
      .expect(200);

    expect(res.body.inProgress).toHaveLength(1);
    expect(res.body.inProgress[0].id).toBe(TASK_ID);
  });

  // SCENARIO 5: Calendar query đồng bộ deadline
  it('Scenario 5: Calendar syncs date range correctly', async () => {
    currentUser = {
      authUserId: 'mgr-1',
      profileId: 'mgr-1',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Dept Web',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/projects/${PROJECT_ID}/calendar?from=2026-08-01&to=2026-08-31`,
      )
      .set(authHeader())
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('dueDate', '2026-08-30');
  });

  // SCENARIO 6: Client Data Isolation
  it('Scenario 6: Client cannot access internal admin or manager APIs', async () => {
    currentUser = {
      authUserId: 'client-1',
      profileId: 'client-1',
      email: 'client@company.com',
      phone: null,
      role: 'client',
      accountStatus: 'active',
      fullName: 'Client Partner',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: null,
    };

    // Client denied admin projects
    await request(app.getHttpServer())
      .get('/api/v1/admin/projects')
      .set(authHeader())
      .expect(403);

    // Client allowed client portal
    await request(app.getHttpServer())
      .get('/api/v1/client/me/projects')
      .set(authHeader())
      .expect(200);
  });
});
