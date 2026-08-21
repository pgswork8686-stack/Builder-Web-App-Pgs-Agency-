import { WorkflowRuntimeService } from './workflow-runtime.service';

describe('Workflow automation event dispatch', () => {
  it('uses the Workflow entity ID in the deterministic idempotency key', async () => {
    const runEvent = jest.fn().mockResolvedValue(undefined);
    const service = new WorkflowRuntimeService(
      { getSystemClient: jest.fn() } as never,
      { createTask: jest.fn() } as never,
      { calculateDueAt: jest.fn() } as never,
      { runEvent } as never,
    );
    const runtime = service as unknown as {
      runEvent: (
        triggerType: 'workflow.started',
        entityId: string,
        projectId: string,
        workflowId: string,
        actorId: string,
      ) => Promise<void>;
    };

    await runtime.runEvent(
      'workflow.started',
      'workflow-42',
      'project-7',
      'workflow-42',
      'actor-3',
    );

    expect(runEvent).toHaveBeenCalledWith({
      triggerType: 'workflow.started',
      eventKey: 'workflow.started:workflow-42',
      payload: {
        projectId: 'project-7',
        workflowId: 'workflow-42',
        entityId: 'workflow-42',
      },
      actorUserId: 'actor-3',
      entityType: 'workflow',
      entityId: 'workflow-42',
      actionUrl: '/app/projects/project-7',
    });
  });
});
