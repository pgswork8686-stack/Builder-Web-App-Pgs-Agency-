import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { SupabaseService } from '../src/supabase/supabase.service';
import { WorkflowRuntimeService } from '../src/workflows/workflow-runtime.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const WORKFLOW_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';
const APPROVAL_ID = '55555555-5555-4555-8555-555555555555';

describe('Phase 4.5 Approval Stress Validation (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
    authUserId: 'admin-id',
    profileId: 'admin-id',
    email: 'admin@example.com',
    phone: null,
    role: 'admin',
    accountStatus: 'active',
    fullName: 'Director Admin',
    avatarUrl: null,
    approvedAt: '2026-01-01',
    departmentId: null,
  };

  const mockWorkflowRuntimeService = {
    requestApproval: jest
      .fn()
      .mockImplementation((projectId, workflowId, dto, user) => ({
        id: APPROVAL_ID,
        projectId,
        projectWorkflowId: workflowId,
        projectWorkflowStageItemId: dto.stageItemId ?? null,
        projectWorkflowStageId: dto.stageId ?? null,
        approvalType: dto.approvalType,
        status: 'pending',
        requestedByUserId: user.profileId,
        requestNote: dto.requestNote ?? null,
        requestedAt: new Date().toISOString(),
      })),
    respondApproval: jest
      .fn()
      .mockImplementation((projectId, workflowId, approvalId, dto, user) => {
        if (user.role === 'employee') {
          throw new ForbiddenException({
            code: 'WORKFLOW_PROJECT_MUTATION_DENIED',
            message: 'Only the Project Manager can mutate this workflow.',
          });
        }
        return {
          id: approvalId,
          projectId,
          projectWorkflowId: workflowId,
          status: dto.decision,
          approverUserId: user.profileId,
          decisionNote: dto.decisionNote ?? null,
          respondedAt: new Date().toISOString(),
        };
      }),
    listApprovals: jest.fn().mockResolvedValue([
      {
        id: APPROVAL_ID,
        projectId: PROJECT_ID,
        projectWorkflowId: WORKFLOW_ID,
        approvalType: 'internal',
        status: 'pending',
      },
    ]),
    getProjectWorkflows: jest.fn().mockResolvedValue([]),
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

  // 1. Multi-level Approval: Manager initiates, Director/Manager responds, Client responds
  it('1. Multi-level approval: Manager requests internal approval and Client approval', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Project Manager',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: 'dept-1',
    };

    // Request internal approval
    const internalRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals`)
      .set(authHeader())
      .send({
        stageItemId: ITEM_ID,
        approvalType: 'internal',
        requestNote: 'Ready for manager review',
      })
      .expect(201);

    expect(internalRes.body).toHaveProperty('status', 'pending');
    expect(internalRes.body).toHaveProperty('approvalType', 'internal');

    // Request client approval
    const clientRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals`)
      .set(authHeader())
      .send({
        stageItemId: ITEM_ID,
        approvalType: 'client',
        requestNote: 'Deliverable ready for client sign-off',
      })
      .expect(201);

    expect(clientRes.body).toHaveProperty('status', 'pending');
    expect(clientRes.body).toHaveProperty('approvalType', 'client');
  });

  // 2. Permission Bypass: Employee CANNOT approve requests
  it('2. Permission bypass: Employee is rejected when attempting to approve', async () => {
    currentUser = {
      authUserId: 'emp-id',
      profileId: 'emp-id',
      email: 'employee@example.com',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Junior Employee',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: 'dept-1',
    };

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authHeader())
      .send({
        decision: 'approved',
        decisionNote: 'Attempted self-approval',
      })
      .expect(403);
  });

  // 3. Manager / Director approves internal request
  it('3. Manager/Director successfully approves internal request', async () => {
    currentUser = {
      authUserId: 'admin-id',
      profileId: 'admin-id',
      email: 'director@example.com',
      phone: null,
      role: 'admin',
      accountStatus: 'active',
      fullName: 'Director Admin',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: null,
    };

    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authHeader())
      .send({
        decision: 'approved',
        decisionNote: 'Approved by Director',
      })
      .expect(201);

    expect(res.body).toHaveProperty('status', 'approved');
  });

  // 4. Reject & Request Revision flow
  it('4. Rejection captures reason and marks decision note for revision', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Project Manager',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: 'dept-1',
    };

    const res = await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authHeader())
      .send({
        decision: 'rejected',
        decisionNote:
          'Design colors do not match brand guidelines. Please revise.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('status', 'rejected');
    expect(res.body).toHaveProperty(
      'decisionNote',
      'Design colors do not match brand guidelines. Please revise.',
    );
  });

  // 5. Query Approvals List
  it('5. Project members can retrieve approval queue', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@example.com',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Project Manager',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: 'dept-1',
    };

    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals`)
      .set(authHeader())
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
