import { WorkflowRuntimeService } from './workflow-runtime.service';

type Progression = {
  unlockItemSuccessors: (
    projectId: string,
    item: Record<string, unknown>,
    user: { profileId: string; role: string },
  ) => Promise<void>;
  ensureReadyAutoTasks: jest.Mock;
};

function buildService() {
  // Every dependency lookup resolves to "no successors".
  const query: Record<string, unknown> = {};
  query.select = jest.fn().mockReturnValue(query);
  query.eq = jest.fn().mockReturnValue(query);
  query.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: [], error: null });
  const service = new WorkflowRuntimeService(
    {
      getSystemClient: jest
        .fn()
        .mockReturnValue({ from: jest.fn().mockReturnValue(query) }),
    } as never,
    { createTask: jest.fn() } as never,
    { calculateDueAt: jest.fn() } as never,
  );
  const progression = service as unknown as Progression;
  progression.ensureReadyAutoTasks = jest.fn().mockResolvedValue(undefined);
  return progression;
}

const item = { id: 'item-1', project_workflow_id: 'workflow-1' };

describe('Workflow progression after an approval', () => {
  it('does not create internal tasks on behalf of a client (would be 403 TASK_ACCESS_DENIED)', async () => {
    const service = buildService();

    await service.unlockItemSuccessors('project-1', item, {
      profileId: 'client-1',
      role: 'client',
    });

    expect(service.ensureReadyAutoTasks).not.toHaveBeenCalled();
  });

  it('still creates ready auto-tasks when an internal user drives the progression', async () => {
    const service = buildService();

    await service.unlockItemSuccessors('project-1', item, {
      profileId: 'leader-1',
      role: 'team_leader',
    });

    expect(service.ensureReadyAutoTasks).toHaveBeenCalledWith(
      'project-1',
      'workflow-1',
      expect.objectContaining({ profileId: 'leader-1' }),
    );
  });
});
