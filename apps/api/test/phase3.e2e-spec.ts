import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { AppRole } from '../src/auth/auth.types';
import { ProjectsService } from '../src/projects/projects.service';
import { ServicesService } from '../src/services/services.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { TasksService } from '../src/tasks/tasks.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

describe('Phase 3 API (e2e)', () => {
  let app: INestApplication;
  let currentRole: AppRole = 'admin';

  const projectsService = {
    getAdminProjects: jest.fn().mockResolvedValue({
      items: [],
      page: 100,
      pageSize: 20,
      total: 38,
      totalPages: 2,
    }),
    createProject: jest.fn().mockImplementation((dto) => ({
      id: PROJECT_ID,
      ...dto,
    })),
    getAdminProjectById: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    updateProject: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    getMemberships: jest.fn().mockResolvedValue([]),
    createMembership: jest.fn().mockResolvedValue({ id: 'membership' }),
    updateMembership: jest.fn().mockResolvedValue({ id: 'membership' }),
    deleteMembership: jest.fn().mockResolvedValue({ success: true }),
    getProjectServices: jest.fn().mockResolvedValue([]),
    createProjectService: jest.fn().mockResolvedValue({ id: 'assignment' }),
    updateProjectService: jest.fn().mockResolvedValue({ id: 'assignment' }),
    deleteProjectService: jest.fn().mockResolvedValue({ success: true }),
    getInternalProjects: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    getInternalProjectById: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    getClientProjects: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    getClientProjectById: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
  };

  const servicesService = {
    getServices: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    getServiceById: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    createService: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    updateService: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
  };

  const tasksService = {
    getTasks: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }),
    createTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
    getTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
    updateTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: '99999999-9999-4999-8999-999999999999',
              email: 'phase3@example.com',
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
              id: '99999999-9999-4999-8999-999999999999',
              role: currentRole,
              account_status: 'active',
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
      .useValue(projectsService)
      .overrideProvider(ServicesService)
      .useValue(servicesService)
      .overrideProvider(TasksService)
      .useValue(tasksService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    currentRole = 'admin';
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const authorized = () => ({ Authorization: 'Bearer phase-3-test-token' });

  it('admin creates a project and receives normalized DTO values', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/projects')
      .set(authorized())
      .send({
        projectCode: ' pgs-2026-001 ',
        clientCompanyId: COMPANY_ID,
        name: 'Project A',
      })
      .expect(201);

    expect(projectsService.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        projectCode: 'PGS-2026-001',
        status: 'draft',
        priority: 'medium',
      }),
      expect.any(String),
    );
  });

  it.each([
    ['invalid status', { status: 'archived' }],
    ['invalid priority', { priority: 'critical' }],
    ['invalid date range', { startDate: '2026-08-12', dueDate: '2026-08-11' }],
  ])('project create rejects %s', async (_label, override) => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/projects')
      .set(authorized())
      .send({
        projectCode: 'PGS-1',
        clientCompanyId: COMPANY_ID,
        name: 'Project',
        ...override,
      })
      .expect(400);
  });

  it('rejects an invalid project UUID before calling the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/projects/not-a-uuid')
      .set(authorized())
      .expect(400);
    expect(projectsService.getAdminProjectById).not.toHaveBeenCalled();
  });

  it('keeps DB list totals and rejects permissive pagination parsing', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/projects?page=100&pageSize=20')
      .set(authorized())
      .expect(200);

    expect(response.body).toMatchObject({ items: [], total: 38, page: 100 });
    await request(app.getHttpServer())
      .get('/api/v1/admin/projects?pageSize=20abc')
      .set(authorized())
      .expect(400);
  });

  it('rejects empty PATCH bodies across Phase 3 resources', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/projects/${PROJECT_ID}`)
      .set(authorized())
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT_ID}/tasks/${TASK_ID}`)
      .set(authorized())
      .send({})
      .expect(400);
  });

  it('enforces admin RBAC on project and service administration', async () => {
    currentRole = 'employee';
    await request(app.getHttpServer())
      .get('/api/v1/admin/projects')
      .set(authorized())
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/services')
      .set(authorized())
      .expect(403);
  });

  it.each(['team_leader', 'employee', 'accountant'] as const)(
    'allows %s to use the scoped projects route',
    async (role) => {
      currentRole = role;
      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(authorized())
        .expect(200);
      expect(projectsService.getInternalProjects).toHaveBeenCalled();
    },
  );

  it('routes clients only through the dedicated client project surface', async () => {
    currentRole = 'client';
    await request(app.getHttpServer())
      .get('/api/v1/client/me/projects')
      .set(authorized())
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set(authorized())
      .expect(403);
  });

  it('passes the authenticated role into task authorization', async () => {
    currentRole = 'client';
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/tasks`)
      .set(authorized())
      .expect(200);

    expect(tasksService.getTasks).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ page: 1, pageSize: 20 }),
      expect.objectContaining({ role: 'client' }),
    );
  });
});
