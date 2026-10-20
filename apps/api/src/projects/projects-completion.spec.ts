import { ProjectsService } from './projects.service';

const PROJECT = {
  id: 'project-1',
  project_code: 'DA_07',
  name: 'Website Hồ Mộc',
  status: 'active',
  client_company_id: 'company-1',
  project_manager_user_id: 'leader-1',
  start_date: null,
  due_date: null,
};

function build(options: {
  openTasks?: number;
  pendingApprovals?: number;
  updated?: Record<string, unknown>;
}) {
  const clientMembers = [
    { user_id: 'client-1', profile: { account_status: 'active' } },
    { user_id: 'client-2', profile: { account_status: 'disabled' } },
  ];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      let head = false;
      for (const method of ['select', 'eq', 'in', 'update', 'single']) {
        builder[method] = (...args: unknown[]) => {
          if (
            method === 'select' &&
            (args[1] as { head?: boolean } | undefined)?.head
          ) {
            head = true;
          }
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) => {
        if (head && table === 'tasks') {
          return resolve({ count: options.openTasks ?? 0, error: null });
        }
        if (head && table === 'workflow_approval_requests') {
          return resolve({ count: options.pendingApprovals ?? 0, error: null });
        }
        if (table === 'client_memberships') {
          return resolve({ data: clientMembers, error: null });
        }
        return resolve({
          data: { ...PROJECT, status: 'completed', ...options.updated },
          error: null,
        });
      };
      return builder;
    },
  };
  const createForUsers = jest.fn().mockResolvedValue([]);
  const service = new ProjectsService(
    { getSystemClient: () => client } as never,
    { createForUser: jest.fn(), createForUsers } as never,
  );
  (service as unknown as Record<string, jest.Mock>).getProjectRow = jest
    .fn()
    .mockResolvedValue(PROJECT);
  return { service, createForUsers };
}

describe('Project completion conditions', () => {
  it('reports what still blocks the acceptance', async () => {
    const { service } = build({ openTasks: 3, pendingApprovals: 1 });

    const check = await service.getCompletionCheck('project-1');

    expect(check.ready).toBe(false);
    expect(check.blockers).toEqual([
      {
        code: 'OPEN_TASKS',
        count: 3,
        message: '3 công việc chưa hoàn thành hoặc chưa hủy',
      },
      {
        code: 'PENDING_APPROVALS',
        count: 1,
        message: '1 yêu cầu duyệt đang chờ phản hồi',
      },
    ]);
  });

  it('is ready when nothing is open', async () => {
    const { service } = build({});

    await expect(
      service.getCompletionCheck('project-1'),
    ).resolves.toMatchObject({
      ready: true,
      blockers: [],
    });
  });

  it('refuses to complete a project with open work (409, with the blockers)', async () => {
    const { service, createForUsers } = build({ openTasks: 2 });

    await expect(
      service.updateProject('project-1', { status: 'completed' }, 'admin-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'PROJECT_COMPLETION_BLOCKED',
        blockers: [expect.objectContaining({ code: 'OPEN_TASKS', count: 2 })],
      },
    });
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('completes a ready project and tells the client and the project manager', async () => {
    const { service, createForUsers } = build({});

    await service.updateProject(
      'project-1',
      { status: 'completed' },
      'admin-1',
    );

    expect(createForUsers).toHaveBeenCalledTimes(2);
    const [clientRecipients, clientInput] = createForUsers.mock.calls[0];
    expect(clientRecipients).toEqual(['client-1']);
    expect(clientInput).toMatchObject({
      type: 'project.completed',
      actionUrl: '/app/client/projects/project-1',
      actorUserId: 'admin-1',
    });
    const [managerRecipients, managerInput] = createForUsers.mock.calls[1];
    expect(managerRecipients).toEqual(['leader-1']);
    expect(managerInput.actionUrl).toBe('/app/projects/project-1');
  });

  it('does not re-check or re-notify a project that is already completed, nor guard other statuses', async () => {
    const done = build({ openTasks: 5 });
    (done.service as unknown as Record<string, jest.Mock>).getProjectRow = jest
      .fn()
      .mockResolvedValue({ ...PROJECT, status: 'completed' });
    await expect(
      done.service.updateProject(
        'project-1',
        { status: 'completed' },
        'admin-1',
      ),
    ).resolves.toBeDefined();
    expect(done.createForUsers).not.toHaveBeenCalled();

    const archive = build({ openTasks: 5, updated: { status: 'archived' } });
    await expect(
      archive.service.updateProject(
        'project-1',
        { status: 'archived' },
        'admin-1',
      ),
    ).resolves.toBeDefined();
    expect(archive.createForUsers).not.toHaveBeenCalled();
  });
});
