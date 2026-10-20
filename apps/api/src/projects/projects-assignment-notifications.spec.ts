import { ProjectsService } from './projects.service';

const PROJECT = {
  id: 'project-1',
  project_code: 'DA_07',
  name: 'Website Hồ Mộc',
  project_manager_user_id: 'old-pm',
};

/** Chainable + thenable stand-in resolving every query with the same row. */
function fakeClient(row: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'eq', 'single']) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: row, error: null });
  return { from: () => builder };
}

function build(row: Record<string, unknown> = PROJECT) {
  const createForUser = jest.fn().mockResolvedValue(null);
  const service = new ProjectsService(
    { getSystemClient: () => fakeClient(row) } as never,
    { createForUser } as never,
  );
  const internals = service as unknown as Record<string, jest.Mock>;
  internals.requireClientCompany = jest.fn().mockResolvedValue(undefined);
  internals.validateProjectManager = jest.fn().mockResolvedValue(undefined);
  internals.validateMembershipRole = jest.fn().mockResolvedValue(undefined);
  internals.getProjectRow = jest.fn().mockResolvedValue(PROJECT);
  return { service, createForUser };
}

const dto = {
  clientCompanyId: 'company-1',
  name: 'Website Hồ Mộc',
  status: 'active',
  priority: 'medium',
  projectManagerUserId: 'leader-1',
} as never;

describe('Project assignment notifications', () => {
  it('tells the project manager when an admin creates the project', async () => {
    const { service, createForUser } = build();

    await service.createProject(dto, 'admin-1');

    expect(createForUser).toHaveBeenCalledTimes(1);
    expect(createForUser.mock.calls[0][0]).toMatchObject({
      recipientUserId: 'leader-1',
      type: 'project.manager_assigned',
      entityType: 'project',
      entityId: 'project-1',
      actionUrl: '/app/projects/project-1',
      actorUserId: 'admin-1',
    });
    expect(createForUser.mock.calls[0][0].message).toContain('DA_07');
  });

  it('does not notify the actor about their own assignment, nor when no manager is set', async () => {
    const own = build();
    await own.service.createProject(dto, 'leader-1');
    expect(own.createForUser).not.toHaveBeenCalled();

    const none = build();
    await none.service.createProject(
      { ...(dto as object), projectManagerUserId: undefined } as never,
      'admin-1',
    );
    expect(none.createForUser).not.toHaveBeenCalled();
  });

  it('notifies only when the manager actually changes', async () => {
    const changed = build();
    await changed.service.updateProject(
      'project-1',
      { projectManagerUserId: 'leader-2' },
      'admin-1',
    );
    expect(changed.createForUser).toHaveBeenCalledTimes(1);
    expect(changed.createForUser.mock.calls[0][0].recipientUserId).toBe(
      'leader-2',
    );

    const same = build();
    await same.service.updateProject(
      'project-1',
      { projectManagerUserId: 'old-pm' },
      'admin-1',
    );
    expect(same.createForUser).not.toHaveBeenCalled();
  });

  it('tells a new member (employee) they were added, with the right type per role', async () => {
    const member = build();
    await member.service.createMembership(
      'project-1',
      { userId: 'employee-1', projectRole: 'member' } as never,
      'leader-1',
    );
    expect(member.createForUser.mock.calls[0][0]).toMatchObject({
      recipientUserId: 'employee-1',
      type: 'project.member_added',
    });

    const manager = build();
    await manager.service.createMembership(
      'project-1',
      { userId: 'leader-2', projectRole: 'project_manager' } as never,
      'admin-1',
    );
    expect(manager.createForUser.mock.calls[0][0].type).toBe(
      'project.manager_assigned',
    );
  });

  it('never fails the write when the notification cannot be created', async () => {
    const { service, createForUser } = build();
    createForUser.mockRejectedValueOnce(new Error('notifications down'));

    await expect(service.createProject(dto, 'admin-1')).resolves.toMatchObject({
      id: 'project-1',
    });
  });
});
