import { WorkflowRuntimeService } from './workflow-runtime.service';

type RuntimeEventCaller = {
  runEvent: (
    triggerType: 'workflow.started' | 'workflow.approval.requested',
    entityId: string,
    projectId: string,
    workflowId: string,
    actorId: string,
    extraPayload?: Record<string, unknown>,
  ) => Promise<void>;
};

function buildService(
  runEvent: jest.Mock,
  project: { client_company_id: string | null } | null,
) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: project });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });
  const service = new WorkflowRuntimeService(
    { getSystemClient: jest.fn().mockReturnValue({ from }) } as never,
    { createTask: jest.fn() } as never,
    { calculateDueAt: jest.fn() } as never,
    { runEvent } as never,
  );
  return {
    runtime: service as unknown as RuntimeEventCaller,
    from,
    select,
    eq,
  };
}

describe('Workflow automation event dispatch', () => {
  it('uses the Workflow entity ID in the deterministic idempotency key', async () => {
    const runEvent = jest.fn().mockResolvedValue(undefined);
    const { runtime, from, select, eq } = buildService(runEvent, {
      client_company_id: 'company-9',
    });

    await runtime.runEvent(
      'workflow.started',
      'workflow-42',
      'project-7',
      'workflow-42',
      'actor-3',
    );

    expect(from).toHaveBeenCalledWith('projects');
    expect(select).toHaveBeenCalledWith('client_company_id');
    expect(eq).toHaveBeenCalledWith('id', 'project-7');
    expect(runEvent).toHaveBeenCalledWith({
      triggerType: 'workflow.started',
      eventKey: 'workflow.started:workflow-42',
      payload: {
        projectId: 'project-7',
        workflowId: 'workflow-42',
        entityId: 'workflow-42',
        clientCompanyId: 'company-9',
      },
      actorUserId: 'actor-3',
      entityType: 'workflow',
      entityId: 'workflow-42',
      actionUrl: '/app/projects/project-7',
    });
  });

  it('adds the client company and approval context so rules can target the client and the requester', async () => {
    const runEvent = jest.fn().mockResolvedValue(undefined);
    const { runtime } = buildService(runEvent, {
      client_company_id: 'company-9',
    });

    await runtime.runEvent(
      'workflow.approval.requested',
      'approval-1',
      'project-7',
      'workflow-42',
      'leader-1',
      { approvalType: 'client', requesterUserId: 'leader-1' },
    );

    expect(runEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'workflow.approval.requested',
        eventKey: 'workflow.approval.requested:approval-1',
        entityType: 'workflow_approval',
        payload: {
          projectId: 'project-7',
          workflowId: 'workflow-42',
          entityId: 'approval-1',
          clientCompanyId: 'company-9',
          approvalType: 'client',
          requesterUserId: 'leader-1',
        },
      }),
    );
  });

  it('still dispatches with a null client company when the project has none', async () => {
    const runEvent = jest.fn().mockResolvedValue(undefined);
    const { runtime } = buildService(runEvent, null);

    await runtime.runEvent(
      'workflow.started',
      'workflow-42',
      'project-7',
      'workflow-42',
      'actor-3',
    );

    expect(runEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ clientCompanyId: null }),
      }),
    );
  });
});
