import type { RequestUser } from '../auth/auth.types';
import { TasksService } from './tasks.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '44444444-4444-4444-8444-444444444444';
const EMPLOYEE_ID = '33333333-3333-4333-8333-333333333333';
const LEADER_ID = '55555555-5555-4555-8555-555555555555';
const PM_ID = '66666666-6666-4666-8666-666666666666';

type Call = { method: string; args: unknown[] };
type Resp = { data?: unknown; error?: unknown };

function actor(role: RequestUser['role'], profileId: string): RequestUser {
  return {
    authUserId: profileId,
    profileId,
    email: `${profileId}@test.local`,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: role === 'employee' ? 'Nhân viên A' : 'Trưởng nhóm B',
    avatarUrl: null,
    approvedAt: null,
  };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    project_id: PROJECT_ID,
    title: 'Thiết kế banner',
    status: 'in_progress',
    priority: 'medium',
    assignee_user_id: EMPLOYEE_ID,
    start_date: null,
    due_date: null,
    ...overrides,
  };
}

/** Table-aware, chainable and thenable stand-in for the Supabase client. */
function setup(options: {
  existing: Record<string, unknown>;
  updated?: Record<string, unknown>;
  membershipRole: string;
}) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const handlers: Record<string, (calls: Call[]) => Resp> = {
    projects: () => ({
      data: { id: PROJECT_ID, project_manager_user_id: PM_ID },
    }),
    project_memberships: (calls) =>
      calls.some((call) => call.method === 'maybeSingle')
        ? { data: { project_role: options.membershipRole } }
        : { data: [{ user_id: LEADER_ID }] },
    tasks: () => ({ data: { ...options.existing } }),
  };
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'in',
        'order',
        'range',
        'update',
        'single',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.insert = (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        calls.push({ method: 'insert', args: [row] });
        return builder;
      };
      builder.then = (resolve: (value: Resp) => unknown) =>
        resolve({
          data: null,
          error: null,
          ...(handlers[table]?.(calls) ?? {}),
        });
      return builder;
    },
    rpc: jest.fn().mockResolvedValue({
      data: options.updated ?? options.existing,
      error: null,
    }),
  };
  const createForUsers = jest.fn().mockResolvedValue([]);
  const service = new TasksService(
    { getSystemClient: () => client } as never,
    undefined,
    { createForUsers, createForUser: jest.fn() } as never,
  );
  return { service, client, inserts, createForUsers };
}

describe('Task review gate (Employee submits, Team Leader decides)', () => {
  const originalFlag = process.env.TASK_ALLOW_ASSIGNEE_DONE;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.TASK_ALLOW_ASSIGNEE_DONE;
    else process.env.TASK_ALLOW_ASSIGNEE_DONE = originalFlag;
  });

  it('refuses an assigned employee who tries to mark their own task done', async () => {
    const { service, client, createForUsers } = setup({
      existing: taskRow({ status: 'in_progress' }),
      membershipRole: 'member',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        actor('employee', EMPLOYEE_ID),
      ),
    ).rejects.toMatchObject({ response: { code: 'TASK_REVIEW_REQUIRED' } });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('refuses an employee reopening an approved task', async () => {
    const { service, client } = setup({
      existing: taskRow({ status: 'done' }),
      membershipRole: 'member',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'in_progress' },
        actor('employee', EMPLOYEE_ID),
      ),
    ).rejects.toMatchObject({ response: { code: 'TASK_REVIEW_REQUIRED' } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('keeps a rollback switch for the previous behaviour', async () => {
    process.env.TASK_ALLOW_ASSIGNEE_DONE = 'true';
    const { service, client } = setup({
      existing: taskRow({ status: 'in_progress' }),
      updated: taskRow({ status: 'done' }),
      membershipRole: 'member',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        actor('employee', EMPLOYEE_ID),
      ),
    ).resolves.toMatchObject({ status: 'done' });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it('notifies the project managers when an employee submits for review', async () => {
    const { service, createForUsers } = setup({
      existing: taskRow({ status: 'in_progress' }),
      updated: taskRow({ status: 'review' }),
      membershipRole: 'member',
    });

    await service.updateTask(
      PROJECT_ID,
      TASK_ID,
      { status: 'review' },
      actor('employee', EMPLOYEE_ID),
    );

    expect(createForUsers).toHaveBeenCalledTimes(1);
    const [recipients, input] = createForUsers.mock.calls[0];
    expect(recipients).toEqual([PM_ID, LEADER_ID]);
    expect(input).toMatchObject({
      type: 'task.review_requested',
      entityType: 'task',
      entityId: TASK_ID,
      actionUrl: `/app/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      actorUserId: EMPLOYEE_ID,
    });
    expect(input.message).toContain('Thiết kế banner');
  });

  it('lets the manager approve, notifying the assignee once', async () => {
    const { service, createForUsers } = setup({
      existing: taskRow({ status: 'review' }),
      updated: taskRow({ status: 'done' }),
      membershipRole: 'project_manager',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        actor('team_leader', LEADER_ID),
      ),
    ).resolves.toMatchObject({ status: 'done' });

    expect(createForUsers).toHaveBeenCalledTimes(1);
    expect(createForUsers.mock.calls[0][0]).toEqual([EMPLOYEE_ID]);
    expect(createForUsers.mock.calls[0][1]).toMatchObject({
      type: 'task.review_approved',
      actorUserId: LEADER_ID,
    });
  });

  it('does not notify again when an already approved task is approved a second time', async () => {
    const { service, createForUsers } = setup({
      existing: taskRow({ status: 'done' }),
      updated: taskRow({ status: 'done' }),
      membershipRole: 'project_manager',
    });

    await service.updateTask(
      PROJECT_ID,
      TASK_ID,
      { status: 'done' },
      actor('team_leader', LEADER_ID),
    );

    expect(createForUsers).not.toHaveBeenCalled();
  });

  it('requires a reason to send work back, then stores it as a comment and tells the assignee', async () => {
    const { service, client, inserts, createForUsers } = setup({
      existing: taskRow({ status: 'review' }),
      updated: taskRow({ status: 'in_progress' }),
      membershipRole: 'project_manager',
    });
    const leader = actor('team_leader', LEADER_ID);

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'in_progress' },
        leader,
      ),
    ).rejects.toMatchObject({ response: { code: 'REVIEW_NOTE_REQUIRED' } });
    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'in_progress', reviewNote: ' abc ' },
        leader,
      ),
    ).rejects.toMatchObject({ response: { code: 'REVIEW_NOTE_REQUIRED' } });
    expect(client.rpc).not.toHaveBeenCalled();

    await service.updateTask(
      PROJECT_ID,
      TASK_ID,
      { status: 'in_progress', reviewNote: 'Logo cần to hơn' },
      leader,
    );

    expect(inserts).toEqual([
      {
        table: 'task_comments',
        row: {
          task_id: TASK_ID,
          author_user_id: LEADER_ID,
          content: 'Yêu cầu chỉnh sửa: Logo cần to hơn',
        },
      },
    ]);
    expect(createForUsers.mock.calls[0][0]).toEqual([EMPLOYEE_ID]);
    expect(createForUsers.mock.calls[0][1]).toMatchObject({
      type: 'task.review_rejected',
    });
    expect(createForUsers.mock.calls[0][1].message).toContain(
      'Lý do: Logo cần to hơn',
    );
    // the note must not leak into the atomic update payload
    expect(JSON.stringify(client.rpc.mock.calls[0])).not.toContain(
      'Logo cần to hơn',
    );
  });

  it('serialises two simultaneous approvals: one transition, one notification', async () => {
    const state = taskRow({ status: 'review' });
    const { service, client, createForUsers } = setup({
      existing: state,
      membershipRole: 'project_manager',
    });
    client.rpc.mockImplementation(async (_name: string, args: any) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      state.status = args.p_status;
      return { data: { ...state }, error: null };
    });

    const results = await Promise.all([
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        actor('team_leader', LEADER_ID),
      ),
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        actor('admin', PM_ID),
      ),
    ]);

    expect(results.map((task) => task.status)).toEqual(['done', 'done']);
    expect(createForUsers).toHaveBeenCalledTimes(1);
    expect(createForUsers.mock.calls[0][1].type).toBe('task.review_approved');
  });

  it('rejects a review note that is not tied to a status change', async () => {
    const { service } = setup({
      existing: taskRow({ status: 'review' }),
      membershipRole: 'project_manager',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { reviewNote: 'Chỉnh lại màu sắc' },
        actor('team_leader', LEADER_ID),
      ),
    ).rejects.toMatchObject({ response: { code: 'REVIEW_NOTE_NOT_ALLOWED' } });
  });

  it('never lets an employee attach a review note', async () => {
    const { service, client } = setup({
      existing: taskRow({ status: 'review' }),
      membershipRole: 'member',
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'in_progress', reviewNote: 'tự duyệt' },
        actor('employee', EMPLOYEE_ID),
      ),
    ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('exposes canApprove only to managers', async () => {
    const manager = setup({
      existing: taskRow({ status: 'review' }),
      membershipRole: 'project_manager',
    });
    const member = setup({
      existing: taskRow({ status: 'review' }),
      membershipRole: 'member',
    });

    await expect(
      manager.service.getTask(
        PROJECT_ID,
        TASK_ID,
        actor('team_leader', LEADER_ID),
      ),
    ).resolves.toMatchObject({ canApprove: true, canUpdateStatus: true });
    await expect(
      member.service.getTask(
        PROJECT_ID,
        TASK_ID,
        actor('employee', EMPLOYEE_ID),
      ),
    ).resolves.toMatchObject({ canApprove: false, canUpdateStatus: true });
  });
});
