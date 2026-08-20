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
    'insert',
    'delete',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.update = jest.fn((value: unknown) => {
    captures.update?.(value);
    return chain;
  });
  chain.single = jest.fn().mockResolvedValue(result);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: (value: QueryResult) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const projectId = '11111111-1111-4111-8111-111111111111';
const workflowId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const approvalId = '44444444-4444-4444-8444-444444444444';
const profileId = '55555555-5555-4555-8555-555555555555';
const stageId = '66666666-6666-4666-8666-666666666666';

function user(role: AppRole): RequestUser {
  return {
    authUserId: profileId,
    profileId,
    email: `${role}@example.com`,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: role,
    avatarUrl: null,
    approvedAt: '2026-01-01T00:00:00.000Z',
  };
}

const project = {
  id: projectId,
  client_company_id: 'client-company-1',
  project_manager_user_id: profileId,
};
const workflow = {
  id: workflowId,
  project_id: projectId,
  status: 'in_progress',
};
const stage = {
  id: stageId,
  project_workflow_id: workflowId,
  status: 'in_progress',
};
const item = {
  id: itemId,
  project_workflow_id: workflowId,
  project_workflow_stage_id: stageId,
  approval_required: true,
  approval_scope: 'both',
  completion_mode: 'tasks_done_and_approval',
  status: 'pending_approval',
  started_at: null,
};

describe('Workflow approval behavior', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let service: WorkflowRuntimeService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    service = new WorkflowRuntimeService(
      { getSystemClient: () => ({ from, rpc }) } as never,
      { createTask: jest.fn() } as never,
      { calculateDueAt: jest.fn() } as never,
    );
  });

  it.each(['internal', 'client'] as const)(
    'atomically requests %s approval and targets the exact Item',
    async (approvalType) => {
      from
        .mockReturnValueOnce(query({ data: project, error: null }))
        .mockReturnValueOnce(query({ data: workflow, error: null }))
        .mockReturnValueOnce(query({ data: item, error: null }))
        .mockReturnValueOnce(query({ data: workflow, error: null }))
        .mockReturnValueOnce(query({ data: stage, error: null }))
        .mockReturnValueOnce(query({ data: workflow, error: null }))
        .mockReturnValueOnce(query({ data: null, error: null }));
      rpc.mockResolvedValueOnce({
        data: { id: approvalId, status: 'pending' },
        error: null,
      });

      await service.requestApproval(
        projectId,
        workflowId,
        { stageItemId: itemId, approvalType },
        user('admin'),
      );

      expect(rpc).toHaveBeenCalledWith('workflow_request_approval', {
        p_project_id: projectId,
        p_workflow_id: workflowId,
        p_stage_item_id: itemId,
        p_stage_id: null,
        p_approval_type: approvalType,
        p_request_note: null,
        p_actor_id: profileId,
      });
    },
  );

  it('does not complete an Item when Tasks are done but an Approval is pending', async () => {
    from
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: item, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: stage, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(
        query({ data: [{ task_id: 'task-1' }], error: null }),
      )
      .mockReturnValueOnce(
        query({ data: [{ id: 'task-1', status: 'done' }], error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              approval_type: 'internal',
              status: 'approved',
              requested_at: '2026-08-20T01:00:00.000Z',
            },
            {
              approval_type: 'client',
              status: 'pending',
              requested_at: '2026-08-20T02:00:00.000Z',
            },
          ],
          error: null,
        }),
      );

    await expect(
      service.completeItem(projectId, itemId, user('admin')),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_APPROVAL_PENDING' },
    });
  });

  it('completes the exact Item after Tasks and both scoped Approvals are approved', async () => {
    const completedUpdate = jest.fn();
    from
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: item, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: stage, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(
        query({ data: [{ task_id: 'task-1' }], error: null }),
      )
      .mockReturnValueOnce(
        query({ data: [{ id: 'task-1', status: 'done' }], error: null }),
      )
      .mockReturnValueOnce(
        query({
          data: [
            {
              approval_type: 'client',
              status: 'approved',
              requested_at: '2026-08-20T02:00:00Z',
            },
            {
              approval_type: 'internal',
              status: 'approved',
              requested_at: '2026-08-20T01:00:00Z',
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query(
          { data: { ...item, status: 'completed' }, error: null },
          { update: completedUpdate },
        ),
      )
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));

    await service.completeItem(projectId, itemId, user('admin'));
    expect(completedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('allows a Project Manager to atomically approve an internal request', async () => {
    const completedUpdate = jest.fn();
    const internalItem = {
      ...item,
      approval_scope: 'internal',
      completion_mode: 'manual',
    };
    from
      .mockReturnValueOnce(
        query({
          data: {
            id: approvalId,
            project_id: projectId,
            project_workflow_id: workflowId,
            project_workflow_stage_item_id: itemId,
            approval_type: 'internal',
            status: 'pending',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: internalItem, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: stage, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(
        query({
          data: [
            {
              approval_type: 'internal',
              status: 'approved',
              requested_at: '2026-08-20T01:00:00Z',
            },
          ],
          error: null,
        }),
      )
      .mockReturnValueOnce(
        query(
          { data: { ...internalItem, status: 'completed' }, error: null },
          { update: completedUpdate },
        ),
      )
      .mockReturnValueOnce(query({ data: null, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    rpc.mockResolvedValueOnce({
      data: { id: approvalId, status: 'approved' },
      error: null,
    });

    await service.respondApproval(
      projectId,
      workflowId,
      approvalId,
      { decision: 'approved' },
      user('admin'),
    );

    expect(rpc).toHaveBeenCalledWith(
      'workflow_respond_approval',
      expect.objectContaining({
        p_approval_id: approvalId,
        p_decision: 'approved',
        p_actor_id: profileId,
      }),
    );
    expect(completedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('atomically rejects an internal request without completing the Item', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: {
            id: approvalId,
            project_id: projectId,
            project_workflow_id: workflowId,
            project_workflow_stage_item_id: itemId,
            approval_type: 'internal',
            status: 'pending',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: item, error: null }))
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    rpc.mockResolvedValueOnce({
      data: { id: approvalId, status: 'rejected' },
      error: null,
    });

    await service.respondApproval(
      projectId,
      workflowId,
      approvalId,
      { decision: 'rejected', decisionNote: 'Needs changes' },
      user('admin'),
    );

    expect(rpc).toHaveBeenCalledWith(
      'workflow_respond_approval',
      expect.objectContaining({
        p_decision: 'rejected',
        p_decision_note: 'Needs changes',
      }),
    );
  });

  it('allows a Client member of the Project company to answer client approval', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: {
            id: approvalId,
            project_id: projectId,
            project_workflow_id: workflowId,
            project_workflow_stage_id: stageId,
            project_workflow_stage_item_id: null,
            approval_type: 'client',
            status: 'pending',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: { id: 'membership-1' }, error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    rpc.mockResolvedValueOnce({
      data: { id: approvalId, status: 'approved' },
      error: null,
    });

    await expect(
      service.respondApproval(
        projectId,
        workflowId,
        approvalId,
        { decision: 'approved' },
        user('client'),
      ),
    ).resolves.toMatchObject({ status: 'approved' });
  });

  it('denies a Client from another Client Company', async () => {
    from
      .mockReturnValueOnce(
        query({
          data: {
            id: approvalId,
            project_id: projectId,
            project_workflow_id: workflowId,
            project_workflow_stage_id: stageId,
            project_workflow_stage_item_id: null,
            approval_type: 'client',
            status: 'pending',
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(query({ data: workflow, error: null }))
      .mockReturnValueOnce(query({ data: project, error: null }))
      .mockReturnValueOnce(query({ data: null, error: null }));

    await expect(
      service.respondApproval(
        projectId,
        workflowId,
        approvalId,
        { decision: 'approved' },
        user('client'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'WORKFLOW_PROJECT_ACCESS_DENIED' },
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
