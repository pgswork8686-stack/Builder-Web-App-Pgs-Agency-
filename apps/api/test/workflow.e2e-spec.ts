import {
  ConflictException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { AppRole } from '../src/auth/auth.types';
import { SupabaseService } from '../src/supabase/supabase.service';
import { WorkflowRuntimeService } from '../src/workflows/workflow-runtime.service';
import { WorkflowService } from '../src/workflows/workflow.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SERVICE_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const WORKFLOW_ID = '55555555-5555-4555-8555-555555555555';
const STAGE_ID = '66666666-6666-4666-8666-666666666666';
const ITEM_ID = '77777777-7777-4777-8777-777777777777';
const DEPENDENCY_ID = '88888888-8888-4888-8888-888888888888';
const APPROVAL_ID = '99999999-9999-4999-8999-999999999999';

type SupertestApp = Parameters<typeof request>[0];
type TestApplication = Omit<INestApplication, 'getHttpServer'> & {
  getHttpServer(): SupertestApp;
};

describe('Workflow Engine V1 API (e2e)', () => {
  let app: TestApplication;
  let currentRole: AppRole = 'admin';

  const workflowService = {
    listTemplates: jest.fn().mockResolvedValue([]),
    getTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    validateTemplateForPublish: jest.fn().mockResolvedValue({
      errors: [],
      warnings: [],
      stats: {
        stages: 1,
        requiredItems: 1,
        mappedRequiredItems: 1,
        optionalItems: 0,
        mappedOptionalItems: 0,
      },
    }),
    createTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    updateTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    cloneTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    publishTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    setDefault: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    archiveTemplate: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    createStage: jest.fn().mockResolvedValue({ id: STAGE_ID }),
    updateStage: jest.fn().mockResolvedValue({ id: STAGE_ID }),
    deleteStage: jest.fn().mockResolvedValue({ deleted: true }),
    mapItem: jest.fn().mockResolvedValue({ id: ITEM_ID }),
    updateMappedItem: jest.fn().mockResolvedValue({ id: ITEM_ID }),
    removeMappedItem: jest.fn().mockResolvedValue({ deleted: true }),
    createStageDependency: jest.fn().mockResolvedValue({ id: DEPENDENCY_ID }),
    deleteStageDependency: jest.fn().mockResolvedValue({ deleted: true }),
    createItemDependency: jest.fn().mockResolvedValue({ id: DEPENDENCY_ID }),
    deleteItemDependency: jest.fn().mockResolvedValue({ deleted: true }),
  };

  const runtimeService = {
    getProjectWorkflows: jest.fn().mockResolvedValue([]),
    instantiateProjectServiceWorkflow: jest
      .fn()
      .mockResolvedValue({ id: WORKFLOW_ID, created: true }),
    startWorkflow: jest.fn().mockResolvedValue({ id: WORKFLOW_ID }),
    startStage: jest.fn().mockResolvedValue({ id: STAGE_ID }),
    completeStage: jest.fn().mockResolvedValue({ id: STAGE_ID }),
    completeItem: jest.fn().mockResolvedValue({ id: ITEM_ID }),
    overrideDependency: jest.fn().mockResolvedValue({ id: DEPENDENCY_ID }),
    listApprovals: jest.fn().mockResolvedValue([]),
    requestApproval: jest.fn().mockResolvedValue({ id: APPROVAL_ID }),
    respondApproval: jest.fn().mockResolvedValue({ id: APPROVAL_ID }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: USER_ID, email: 'workflow@example.com' } },
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
      .overrideProvider(WorkflowService)
      .useValue(workflowService)
      .overrideProvider(WorkflowRuntimeService)
      .useValue(runtimeService)
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

  const authorized = () => ({ Authorization: 'Bearer workflow-token' });

  it('requires authentication for template and project runtime endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/workflows/templates')
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/workflows`)
      .expect(401);
  });

  it('allows admin template management and forwards the authenticated actor', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/workflows/templates')
      .set(authorized())
      .send({ serviceId: SERVICE_ID, name: 'Delivery workflow' })
      .expect(201)
      .expect(({ body }) => expect(body.id).toBe(WORKFLOW_ID));

    expect(workflowService.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: SERVICE_ID }),
      expect.objectContaining({ profileId: USER_ID, role: 'admin' }),
    );
  });

  it('allows internal reads but keeps template mutations admin-only', async () => {
    currentRole = 'employee';
    await request(app.getHttpServer())
      .get('/api/v1/admin/workflows/templates')
      .set(authorized())
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/admin/workflows/templates')
      .set(authorized())
      .send({ serviceId: SERVICE_ID, name: 'Forbidden draft' })
      .expect(403);
    expect(workflowService.createTemplate).not.toHaveBeenCalled();
  });

  it('passes the actor and project identity into runtime authorization', async () => {
    currentRole = 'client';
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/workflows`)
      .set(authorized())
      .expect(200);

    expect(runtimeService.getProjectWorkflows).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ profileId: USER_ID, role: 'client' }),
    );
  });

  it('preserves forbidden responses for non-member and cross-project access', async () => {
    runtimeService.getProjectWorkflows.mockRejectedValueOnce(
      new ForbiddenException('WORKFLOW_PROJECT_ACCESS_DENIED'),
    );
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${OTHER_PROJECT_ID}/workflows`)
      .set(authorized())
      .expect(403);
  });

  it('preserves non-PM mutation denial and dependency-blocked conflicts', async () => {
    currentRole = 'employee';
    runtimeService.startWorkflow.mockRejectedValueOnce(
      new ForbiddenException('WORKFLOW_PROJECT_WRITE_DENIED'),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/start`)
      .set(authorized())
      .expect(403);

    runtimeService.startStage.mockRejectedValueOnce(
      new ConflictException('WORKFLOW_STAGE_DEPENDENCY_BLOCKED'),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/stages/${STAGE_ID}/start`)
      .set(authorized())
      .expect(409);
  });

  it('routes dependency overrides with a required reason', async () => {
    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_ID}/workflows/dependencies/${DEPENDENCY_ID}/override`,
      )
      .set(authorized())
      .send({ reason: 'Approved operational exception' })
      .expect(201);

    expect(runtimeService.overrideDependency).toHaveBeenCalledWith(
      PROJECT_ID,
      DEPENDENCY_ID,
      'Approved operational exception',
      expect.objectContaining({ profileId: USER_ID }),
    );
  });

  it('routes exact-target approval requests and responses with project context', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals`)
      .set(authorized())
      .send({ stageItemId: ITEM_ID, approvalType: 'internal' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals/${APPROVAL_ID}/respond`,
      )
      .set(authorized())
      .send({ decision: 'approved', decisionNote: 'Accepted' })
      .expect(201);

    expect(runtimeService.requestApproval).toHaveBeenCalledWith(
      PROJECT_ID,
      WORKFLOW_ID,
      expect.objectContaining({ stageItemId: ITEM_ID }),
      expect.objectContaining({ profileId: USER_ID }),
    );
    expect(runtimeService.respondApproval).toHaveBeenCalledWith(
      PROJECT_ID,
      WORKFLOW_ID,
      APPROVAL_ID,
      expect.objectContaining({ decision: 'approved' }),
      expect.objectContaining({ profileId: USER_ID }),
    );
  });

  it('returns 400 before the service when an approval request has two targets', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/workflows/${WORKFLOW_ID}/approvals`)
      .set(authorized())
      .send({
        stageItemId: ITEM_ID,
        stageId: STAGE_ID,
        approvalType: 'internal',
      })
      .expect(400);

    expect(runtimeService.requestApproval).not.toHaveBeenCalled();
  });
});
