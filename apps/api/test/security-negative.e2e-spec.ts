/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { AppRole } from '../src/auth/auth.types';
import { SupabaseService } from '../src/supabase/supabase.service';
import { ProjectsService } from '../src/projects/projects.service';
import { FinanceService } from '../src/finance/finance.service';
import { TasksService } from '../src/tasks/tasks.service';
import { LeaveService } from '../src/leave/leave.service';
import { PeopleService } from '../src/people/people.service';
import { FilesService } from '../src/workspace/files.service';
import { ClientsService } from '../src/clients/clients.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const LEADER_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_A_ID = '33333333-3333-4333-8333-333333333333';
const ACCOUNTANT_ID = '55555555-5555-4555-8555-555555555555';
const CLIENT_A_ID = '66666666-6666-4666-8666-666666666666';

const PROJECT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TASK_A_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TASK_B_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONTRACT_A_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const INVOICE_A_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const FILE_A_ID = '00000000-0000-4000-8000-000000000000';

describe('Comprehensive Security & Negative Authorization Matrix (e2e)', () => {
  let app: INestApplication;
  let currentRole: AppRole = 'admin';
  let currentUserId: string = ADMIN_ID;

  const mockClientsService = {
    getClientCompanies: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getClientCompanyById: jest.fn().mockResolvedValue({ id: 'c-1' }),
  };

  const mockProjectsService = {
    getAdminProjects: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    createProject: jest.fn().mockResolvedValue({ id: PROJECT_A_ID }),
    getAdminProjectById: jest.fn().mockResolvedValue({ id: PROJECT_A_ID }),
    updateProject: jest.fn().mockResolvedValue({ id: PROJECT_A_ID }),
    getInternalProjects: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getInternalProjectById: jest
      .fn()
      .mockImplementation((userId: string, projectId: string) => {
        if (projectId === PROJECT_B_ID && userId === EMPLOYEE_A_ID) {
          throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED' });
        }
        return { id: projectId };
      }),
    getClientProjects: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getClientProjectById: jest
      .fn()
      .mockImplementation((userId: string, projectId: string) => {
        if (projectId === PROJECT_B_ID && userId === CLIENT_A_ID) {
          throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED' });
        }
        return { id: projectId };
      }),
  };

  const mockTasksService = {
    getTasks: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    createTask: jest
      .fn()
      .mockImplementation((projectId: string, _dto, user) => {
        if (projectId === PROJECT_B_ID && user.profileId === EMPLOYEE_A_ID) {
          throw new ForbiddenException({ code: 'PROJECT_ACCESS_DENIED' });
        }
        return { id: TASK_A_ID };
      }),
    updateTask: jest
      .fn()
      .mockImplementation((projectId: string, taskId: string, _dto, user) => {
        if (taskId === TASK_B_ID && user.profileId === EMPLOYEE_A_ID) {
          throw new ForbiddenException({ code: 'TASK_ACCESS_DENIED' });
        }
        return { id: taskId };
      }),
  };

  const mockFinanceService = {
    getContracts: jest.fn().mockImplementation((_query, user) => {
      if (user.role === 'employee') {
        throw new ForbiddenException({ code: 'FINANCE_ACCESS_DENIED' });
      }
      return { items: [], total: 0 };
    }),
    getContractById: jest
      .fn()
      .mockImplementation((contractId: string, user) => {
        if (user.role === 'client' && contractId !== CONTRACT_A_ID) {
          throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND' });
        }
        return { id: contractId };
      }),
    getInvoices: jest.fn().mockImplementation((_query, user) => {
      if (user.role === 'employee') {
        throw new ForbiddenException({ code: 'FINANCE_ACCESS_DENIED' });
      }
      return { items: [], total: 0 };
    }),
    getInvoiceById: jest.fn().mockImplementation((invoiceId: string, user) => {
      if (user.role === 'client' && invoiceId !== INVOICE_A_ID) {
        throw new NotFoundException({ code: 'INVOICE_NOT_FOUND' });
      }
      return { id: invoiceId };
    }),
    recordPayment: jest.fn().mockResolvedValue({ id: 'payment-id' }),
  };

  const mockLeaveService = {
    getMyRequests: jest.fn().mockResolvedValue([]),
    getMyBalances: jest.fn().mockResolvedValue([]),
    createRequest: jest.fn().mockResolvedValue({ id: 'req-1' }),
    reviewRequest: jest.fn().mockImplementation((_requestId, _dto, user) => {
      if (user.role === 'employee' || user.role === 'client') {
        throw new ForbiddenException({ code: 'LEAVE_REVIEW_DENIED' });
      }
      return { id: 'req-1' };
    }),
  };

  const mockPeopleService = {
    getPeopleDirectory: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getPersonByUserId: jest.fn().mockResolvedValue({ id: EMPLOYEE_A_ID }),
    updatePersonFull: jest.fn().mockResolvedValue({ id: EMPLOYEE_A_ID }),
    deletePerson: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockFilesService = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    download: jest
      .fn()
      .mockImplementation((projectId: string, fileId: string, user) => {
        if (projectId === PROJECT_B_ID && user.profileId === CLIENT_A_ID) {
          throw new ForbiddenException({ code: 'FILE_ACCESS_DENIED' });
        }
        return { signedUrl: 'https://storage.example/download' };
      }),
    remove: jest
      .fn()
      .mockImplementation((projectId: string, fileId: string, user) => {
        if (projectId === PROJECT_B_ID || user.role === 'client') {
          throw new ForbiddenException({ code: 'FILE_ACCESS_DENIED' });
        }
        return { success: true };
      }),
  };

  beforeAll(async () => {
    const mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockImplementation(() => {
          return Promise.resolve({
            data: {
              user: {
                id: currentUserId,
                email: `${currentRole}@example.com`,
              },
            },
            error: null,
          });
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                data: {
                  id: currentUserId,
                  email: `${currentRole}@example.com`,
                  role: currentRole,
                  account_status: 'active',
                },
                error: null,
              });
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
        createUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
      })
      .overrideProvider(ClientsService)
      .useValue(mockClientsService)
      .overrideProvider(ProjectsService)
      .useValue(mockProjectsService)
      .overrideProvider(TasksService)
      .useValue(mockTasksService)
      .overrideProvider(FinanceService)
      .useValue(mockFinanceService)
      .overrideProvider(LeaveService)
      .useValue(mockLeaveService)
      .overrideProvider(PeopleService)
      .useValue(mockPeopleService)
      .overrideProvider(FilesService)
      .useValue(mockFilesService)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = () => ({
    Authorization: 'Bearer valid-jwt-token',
  });

  // ============================================================================
  // 1. ADMIN PERMISSION TESTS
  // ============================================================================
  describe('ADMIN Role Permissions', () => {
    beforeEach(() => {
      currentRole = 'admin';
      currentUserId = ADMIN_ID;
    });

    it('allows Admin to perform administrative project creation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/projects')
        .set(authHeader())
        .send({
          projectCode: 'PGS-ADMIN',
          clientCompanyId: '11111111-1111-4111-8111-111111111111',
          name: 'Admin Project',
        })
        .expect(201);
    });

    it('allows Admin to access administrative client management', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/clients')
        .set(authHeader())
        .expect(200);
    });
  });

  // ============================================================================
  // 2. TEAM LEADER PERMISSION TESTS & SCOPE RESTRICTIONS
  // ============================================================================
  describe('TEAM LEADER Role Permissions & Scoping', () => {
    beforeEach(() => {
      currentRole = 'team_leader';
      currentUserId = LEADER_ID;
    });

    it('allows Team Leader to view scoped projects', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(authHeader())
        .expect(200);
    });

    it('denies Team Leader from accessing global admin settings', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/projects')
        .set(authHeader())
        .expect(403);
    });

    it('denies Team Leader from altering department structure', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set(authHeader())
        .send({ name: 'Hacked Department', code: 'HACK' })
        .expect(403);
    });
  });

  // ============================================================================
  // 3. EMPLOYEE NEGATIVE TESTS (IDOR, Cross-Project, Finance & Leave)
  // ============================================================================
  describe('EMPLOYEE Role Negative Tests', () => {
    beforeEach(() => {
      currentRole = 'employee';
      currentUserId = EMPLOYEE_A_ID;
    });

    it('denies Employee from accessing foreign project workspace (IDOR)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${PROJECT_B_ID}`)
        .set(authHeader())
        .expect(403);
    });

    it('denies Employee from modifying tasks in a foreign project', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${PROJECT_B_ID}/tasks/${TASK_B_ID}`)
        .set(authHeader())
        .send({ title: 'Unauthorized Task Modification' })
        .expect(403);
    });

    it('denies Employee from reviewing / approving leave requests', async () => {
      await request(app.getHttpServer())
        .post(
          '/api/v1/leave/requests/11111111-1111-4111-8111-111111111111/review',
        )
        .set(authHeader())
        .send({ action: 'approved', reviewNote: 'Auto approve' })
        .expect(403);
    });

    it('denies Employee from viewing finance contracts and invoices', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/finance/contracts')
        .set(authHeader())
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/v1/finance/invoices')
        .set(authHeader())
        .expect(403);
    });
  });

  // ============================================================================
  // 4. ACCOUNTANT ROLE PERMISSION & MUTATION RESTRICTIONS
  // ============================================================================
  describe('ACCOUNTANT Role Permissions & Denials', () => {
    beforeEach(() => {
      currentRole = 'accountant';
      currentUserId = ACCOUNTANT_ID;
    });

    it('allows Accountant to access finance summary and invoices', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/finance/invoices')
        .set(authHeader())
        .expect(200);
    });

    it('denies Accountant from creating administrative departments', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/departments')
        .set(authHeader())
        .send({ name: 'Finance Sub-Dept', code: 'FIN_SUB' })
        .expect(403);
    });

    it('denies Accountant from mutating employee profiles / admin directory', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/people/${EMPLOYEE_A_ID}/full`)
        .set(authHeader())
        .send({ fullName: 'Tampered Name' })
        .expect(403);
    });
  });

  // ============================================================================
  // 5. CLIENT ROLE RESTRICTIONS & FOREIGN DATA ACCESS (IDOR)
  // ============================================================================
  describe('CLIENT Role Restrictions & Foreign IDOR Protection', () => {
    beforeEach(() => {
      currentRole = 'client';
      currentUserId = CLIENT_A_ID;
    });

    it('allows Client to view dedicated /client/me/projects endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/client/me/projects')
        .set(authHeader())
        .expect(200);
    });

    it('denies Client from accessing internal /projects route', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set(authHeader())
        .expect(403);
    });

    it('denies Client from viewing foreign client project (IDOR)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/client/me/projects/${PROJECT_B_ID}`)
        .set(authHeader())
        .expect(403);
    });

    it('returns 404/denies Client when trying to access foreign contract IDOR', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/finance/contracts/ffffffff-ffff-4fff-8fff-ffffffffffff')
        .set(authHeader())
        .expect(404);
    });

    it('denies Client from downloading files belonging to foreign projects', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${PROJECT_B_ID}/files/${FILE_A_ID}/download`)
        .set(authHeader())
        .expect(403);
    });

    it('denies Client from deleting project files', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${PROJECT_A_ID}/files/${FILE_A_ID}`)
        .set(authHeader())
        .expect(403);
    });
  });
});
