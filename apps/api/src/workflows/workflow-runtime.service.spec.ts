import type { AppRole, RequestUser } from '../auth/auth.types';
import { WorkflowRuntimeService } from './workflow-runtime.service';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function query(result: QueryResult, captures: { update?: jest.Mock } = {}) {
  const chain: Record<string, unknown> = {};
  for (const method of [
    'select',
    'eq',
    'in',
    'order',
    'limit',
    'is',
    'update',
    'insert',
    'delete',
  ]) {
    chain[method] =
      method === 'update'
        ? jest.fn((value: unknown) => {
            captures.update?.(value);
            return chain;
          })
        : jest.fn(() => chain);
  }
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const projectId = '11111111-1111-4111-8111-111111111111';
const workflowId = '22222222-2222-4222-8222-222222222222';
const stageId = '33333333-3333-4333-8333-333333333333';
const profileId = '44444444-4444-4444-8444-444444444444';

function user(role: AppRole, id = profileId): RequestUser {
  return {
    authUserId: id,
    profileId: id,
    email: `${role}@example.com`,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: role,
    avatarUrl: null,
    approvedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('WorkflowRuntimeService project authorization', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let tasksService: { createTask: jest.Mock };
  let slaService: { calculateDueAt: jest.Mock };
  let service: WorkflowRuntimeService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    tasksService = { createTask: jest.fn() };
    slaService = {
      calculateDueAt: jest.fn().mockResolvedValue({
        configured: false,
        dueAt: null,
        reason: 'WORK_HOURS_NOT_CONFIGURED',
      }),
    };
    service = new WorkflowRuntimeService(
      { getSystemClient: () => ({ from, rpc }) } as never,
      tasksService as never,
      slaService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const project = (managerId: string | null = null) => ({
    id: projectId,
    client_company_id: 'client-company-1',
    project_manager_user_id: managerId,
  });

  it('denies an Employee who is not a Project Member', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    await expect(
      service.requireProjectAccess(projectId, user('employee'), 'read'),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_ACCESS_DENIED' },
    });
  });

  it('allows an Employee Project Member to read', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({ data: { project_role: 'member' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('employee'), 'read'),
    ).resolves.toMatchObject({
      isProjectManager: false,
      projectRole: 'member',
    });
  });

  it('denies mutation by a non-manager Employee Member', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({ data: { project_role: 'member' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('employee'), 'write'),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_MUTATION_DENIED' },
    });
  });

  it('does not treat a global Team Leader as Project Manager', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({ data: { project_role: 'member' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('team_leader'), 'write'),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_MUTATION_DENIED' },
    });
  });

  it('allows the Project Manager to mutate', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({ data: { project_role: 'project_manager' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('employee'), 'write'),
    ).resolves.toMatchObject({ isProjectManager: true });
  });

  it('allows the projects.project_manager_user_id owner to mutate', async () => {
    from
      .mockReturnValueOnce(query({ data: project(profileId), error: null }))
      .mockReturnValueOnce(
        query({ data: { project_role: 'member' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('accountant'), 'write'),
    ).resolves.toMatchObject({ isProjectManager: true });
  });

  it('allows Admin to read and mutate all projects', async () => {
    from.mockReturnValue(query({ data: project(), error: null }));
    await expect(
      service.requireProjectAccess(projectId, user('admin'), 'write'),
    ).resolves.toMatchObject({ isAdmin: true, isProjectManager: true });
  });

  it('allows a Client to read its own company project', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({ data: { id: 'membership-1' }, error: null }),
      );
    await expect(
      service.requireProjectAccess(projectId, user('client'), 'read'),
    ).resolves.toMatchObject({ isClient: true });
  });

  it('does not expose dependency override actors or reasons to Clients', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: { id: 'membership-1' }, error: null }))
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: workflowId,
              stages: [],
              approvals: [],
              stage_dependencies: [
                {
                  id: 'stage-dependency-1',
                  overridden_at: '2026-08-20T01:00:00.000Z',
                  overridden_by: 'internal-user-id',
                  override_reason: 'Internal escalation detail',
                },
              ],
              item_dependencies: [
                {
                  id: 'item-dependency-1',
                  overridden_at: '2026-08-20T01:00:00.000Z',
                  overridden_by: 'internal-user-id',
                  override_reason: 'Internal escalation detail',
                },
              ],
            },
          ],
          error: null,
        }),
      );

    const [workflow] = await service.getProjectWorkflows(
      projectId,
      user('client'),
    );
    expect(workflow.stage_dependencies).toEqual([
      {
        id: 'stage-dependency-1',
        overridden_at: '2026-08-20T01:00:00.000Z',
      },
    ]);
    expect(workflow.item_dependencies).toEqual([
      {
        id: 'item-dependency-1',
        overridden_at: '2026-08-20T01:00:00.000Z',
      },
    ]);
  });

  it('denies a Client from another company', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    await expect(
      service.requireProjectAccess(projectId, user('client'), 'read'),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_ACCESS_DENIED' },
    });
  });

  it('denies every Client workflow mutation', async () => {
    from.mockReturnValueOnce(query({ data: project(), error: null }));
    await expect(
      service.requireProjectAccess(projectId, user('client'), 'write'),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_MUTATION_DENIED' },
    });
  });

  it('denies a Stage ID whose Workflow belongs to another Project', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'ready',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: null, error: null }));
    await expect(
      service.startStage(projectId, stageId, user('admin')),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_NOT_FOUND' },
    });
  });

  it('returns the existing Workflow on an idempotent instantiate retry', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    rpc.mockResolvedValueOnce({
      data: { instantiated: true, workflowId, isExisting: true },
      error: null,
    });

    await expect(
      service.instantiateProjectServiceWorkflow(
        projectId,
        '55555555-5555-4555-8555-555555555555',
        user('admin'),
      ),
    ).resolves.toEqual({ instantiated: true, workflowId, isExisting: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('returns an in-progress Workflow without resetting its start timestamp', async () => {
    const startedAt = '2026-08-20T01:00:00.000Z';
    const workflow = {
      id: workflowId,
      project_id: projectId,
      status: 'in_progress',
      started_at: startedAt,
    };
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }));

    await expect(
      service.startWorkflow(projectId, workflowId, user('admin')),
    ).resolves.toEqual(workflow);
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('enforces runtime predecessor state even if a Stage status says ready', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'ready',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: 'dependency-1',
              predecessor_stage_id: 'predecessor-1',
              overridden_at: null,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ id: 'predecessor-1', status: 'in_progress' }],
          error: null,
        }),
      );

    await expect(
      service.startStage(projectId, stageId, user('admin')),
    ).rejects.toMatchObject({
      response: {
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        blockedBy: ['predecessor-1'],
      },
    });
  });

  it('persists exact Stage and initial Item deadlines from the same activation time', async () => {
    const activatedAt = '2026-08-24T02:30:00.000Z';
    const stageDueAt = '2026-08-24T06:30:00.000Z';
    const itemDueAt = '2026-08-24T04:30:00.000Z';
    const itemId = '55555555-5555-4555-8555-555555555555';
    const stageUpdate = jest.fn();
    const itemUpdate = jest.fn();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(activatedAt));
    slaService.calculateDueAt
      .mockResolvedValueOnce({ configured: true, dueAt: stageDueAt })
      .mockResolvedValueOnce({ configured: true, dueAt: itemDueAt });
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'ready',
            started_at: null,
            due_at: null,
            sla_hours_snapshot: 4,
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(
        query(
          {
            data: {
              id: stageId,
              project_workflow_id: workflowId,
              status: 'in_progress',
              started_at: activatedAt,
              due_at: stageDueAt,
            },
            error: null,
          },
          { update: stageUpdate },
        ),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: itemId,
              status: 'ready',
              sla_hours_snapshot: 2,
              due_at: null,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: null, error: null }, { update: itemUpdate }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));

    await service.startStage(projectId, stageId, user('admin'));

    expect(slaService.calculateDueAt).toHaveBeenNthCalledWith(
      1,
      new Date(activatedAt),
      4,
    );
    expect(slaService.calculateDueAt).toHaveBeenNthCalledWith(
      2,
      new Date(activatedAt),
      2,
    );
    expect(stageUpdate).toHaveBeenCalledWith({
      status: 'in_progress',
      started_at: activatedAt,
      due_at: stageDueAt,
    });
    expect(itemUpdate).toHaveBeenCalledWith({ due_at: itemDueAt });
  });

  it('preserves persisted deadlines when startStage is retried', async () => {
    const activatedAt = '2026-08-24T02:30:00.000Z';
    const stageDueAt = '2026-08-24T06:30:00.000Z';
    const itemDueAt = '2026-08-24T04:30:00.000Z';
    const stage = {
      id: stageId,
      project_workflow_id: workflowId,
      status: 'in_progress',
      started_at: activatedAt,
      due_at: stageDueAt,
    };
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(query({ data: stage, error: null }))
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: 'item-1',
              status: 'ready',
              sla_hours_snapshot: 2,
              due_at: itemDueAt,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }));

    await expect(
      service.startStage(projectId, stageId, user('admin')),
    ).resolves.toEqual(stage);
    expect(slaService.calculateDueAt).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(5);
  });

  it('persists an exact deadline when an Item dependency unlocks', async () => {
    const unlockedAt = '2026-08-24T02:30:00.000Z';
    const itemDueAt = '2026-08-24T04:30:00.000Z';
    const successorItemId = '55555555-5555-4555-8555-555555555555';
    const itemUpdate = jest.fn();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(unlockedAt));
    slaService.calculateDueAt.mockResolvedValueOnce({
      configured: true,
      dueAt: itemDueAt,
    });
    from
      .mockReturnValueOnce(
        query({
          data: [{ successor_stage_item_id: successorItemId }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              predecessor_stage_item_id: 'predecessor-item',
              overridden_at: null,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: [{ status: 'completed' }], error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: successorItemId,
            project_workflow_id: workflowId,
            project_workflow_stage_id: stageId,
            status: 'locked',
            sla_hours_snapshot: 2,
            due_at: null,
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'in_progress',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query(
          { data: { id: successorItemId }, error: null },
          { update: itemUpdate },
        ),
      )
      .mockReturnValueOnce(query({ data: [], error: null }));

    const runtime = service as unknown as {
      unlockItemSuccessors: (
        requestedProjectId: string,
        completedItem: Record<string, unknown>,
        actor: RequestUser,
      ) => Promise<void>;
    };
    await runtime.unlockItemSuccessors(
      projectId,
      { id: 'predecessor-item', project_workflow_id: workflowId },
      user('admin'),
    );

    expect(slaService.calculateDueAt).toHaveBeenCalledWith(
      new Date(unlockedAt),
      2,
    );
    expect(itemUpdate).toHaveBeenCalledWith({
      status: 'ready',
      due_at: itemDueAt,
    });
  });

  it('blocks Item completion while a runtime Item predecessor is incomplete', async () => {
    const itemId = '55555555-5555-4555-8555-555555555555';
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: {
            id: itemId,
            project_workflow_id: workflowId,
            project_workflow_stage_id: stageId,
            completion_mode: 'manual',
            status: 'ready',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'in_progress',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              predecessor_stage_item_id: 'predecessor-item',
              overridden_at: null,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ id: 'predecessor-item', status: 'in_progress' }],
          error: null,
        }),
      );

    await expect(
      service.completeItem(projectId, itemId, user('admin')),
    ).rejects.toMatchObject({
      response: {
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        blockedBy: ['predecessor-item'],
      },
    });
  });

  it('unlocks a successor Stage after every predecessor is completed', async () => {
    const successorUpdate = jest.fn();
    from
      .mockReturnValueOnce(
        query({
          data: [{ successor_stage_id: 'successor-stage' }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({
          data: [{ predecessor_stage_id: stageId, overridden_at: null }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: [{ status: 'completed' }], error: null }),
      )
      .mockReturnValueOnce(
        query(
          { data: { id: 'successor-stage' }, error: null },
          { update: successorUpdate },
        ),
      )
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));

    const runtime = service as unknown as {
      unlockStageSuccessors: (
        requestedProjectId: string,
        requestedWorkflowId: string,
        completedStageId: string,
        actor: RequestUser,
      ) => Promise<void>;
    };
    await runtime.unlockStageSuccessors(
      projectId,
      workflowId,
      stageId,
      user('admin'),
    );
    expect(successorUpdate).toHaveBeenCalledWith({ status: 'ready' });
  });

  it('completes a Workflow when all required Stages resolve, regardless of optional Stages', async () => {
    const workflowUpdate = jest.fn();
    from
      .mockReturnValueOnce(
        query({
          data: [{ status: 'completed' }, { status: 'skipped' }],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: null, error: null }, { update: workflowUpdate }),
      );

    const runtime = service as unknown as {
      completeWorkflowIfReady: (
        requestedProjectId: string,
        requestedWorkflowId: string,
      ) => Promise<void>;
    };
    await runtime.completeWorkflowIfReady(projectId, workflowId);
    expect(workflowUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('does not complete a Workflow while a required Stage is incomplete', async () => {
    from.mockReturnValueOnce(
      query({
        data: [{ status: 'completed' }, { status: 'in_progress' }],
        error: null,
      }),
    );
    const runtime = service as unknown as {
      completeWorkflowIfReady: (
        requestedProjectId: string,
        requestedWorkflowId: string,
      ) => Promise<void>;
    };
    await runtime.completeWorkflowIfReady(projectId, workflowId);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('requires a meaningful dependency override reason', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: { id: 'dependency-1', project_workflow_id: workflowId },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      );
    await expect(
      service.overrideDependency(
        projectId,
        'dependency-1',
        ' x ',
        user('admin'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_OVERRIDE_REASON_INVALID' },
    });
  });

  it('does not create a duplicate primary Task when a link already exists', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: 'item-1',
              project_service_item_id: 'service-item-1',
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: { task_id: 'task-1' }, error: null }));
    rpc.mockResolvedValueOnce({
      data: { instantiated: true, workflowId, isExisting: true },
      error: null,
    });

    await service.instantiateProjectServiceWorkflow(
      projectId,
      '55555555-5555-4555-8555-555555555555',
      user('admin'),
    );
    expect(tasksService.createTask).not.toHaveBeenCalled();
  });

  it('delegates new primary Task creation to the atomic TasksService workflow path', async () => {
    const projectServiceItemId = '66666666-6666-4666-8666-666666666666';
    const workflowItemId = '77777777-7777-4777-8777-777777777777';
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: [
            {
              id: workflowItemId,
              project_service_item_id: projectServiceItemId,
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(
        query({ data: { name: 'Client handoff' }, error: null }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }));
    rpc.mockResolvedValueOnce({
      data: { instantiated: true, workflowId, isExisting: false },
      error: null,
    });
    tasksService.createTask.mockResolvedValueOnce({ id: 'task-1' });

    await service.instantiateProjectServiceWorkflow(
      projectId,
      '55555555-5555-4555-8555-555555555555',
      user('admin'),
    );

    expect(tasksService.createTask).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        projectServiceItemId,
        title: 'Client handoff',
        status: 'todo',
        priority: 'medium',
      }),
      expect.objectContaining({ profileId }),
      { workflowStageItemId: workflowItemId },
    );
  });

  it('blocks Stage completion while any Item is incomplete', async () => {
    from
      .mockReturnValueOnce(query({ data: project(), error: null }))
      .mockReturnValueOnce(
        query({
          data: {
            id: stageId,
            project_workflow_id: workflowId,
            status: 'in_progress',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query({ data: { id: workflowId, project_id: projectId }, error: null }),
      )
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(
        query({ data: [{ id: 'item-1', status: 'ready' }], error: null }),
      );
    await expect(
      service.completeStage(projectId, stageId, user('admin')),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_STAGE_ITEMS_INCOMPLETE' },
    });
  });
});
