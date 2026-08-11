import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from './tasks.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const TASK_ID = '44444444-4444-4444-8444-444444444444';
const ASSIGNEE_ID = '55555555-5555-4555-8555-555555555555';

function queryResult(
  result: { data?: unknown; count?: number | null; error?: unknown },
  terminal: 'maybeSingle' | 'single' | 'range' = 'maybeSingle',
) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'eq',
    'ilike',
    'order',
    'range',
    'insert',
    'update',
    'single',
    'maybeSingle',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query[terminal] = jest.fn().mockResolvedValue({
    data: null,
    error: null,
    ...result,
  });
  return query;
}

function user(role: RequestUser['role'], profileId = USER_ID): RequestUser {
  return {
    authUserId: profileId,
    profileId,
    email: null,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: null,
    avatarUrl: null,
    approvedAt: null,
  };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    project_id: PROJECT_ID,
    title: 'Task',
    status: 'todo',
    priority: 'medium',
    assignee_user_id: ASSIGNEE_ID,
    start_date: null,
    due_date: null,
    ...overrides,
  };
}

describe('TasksService', () => {
  let service: TasksService;
  let client: { from: jest.Mock };

  beforeEach(() => {
    client = { from: jest.fn() };
    service = new TasksService({
      getSystemClient: () => client,
    } as unknown as SupabaseService);
  });

  it('creates a task for an admin', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult({ data: taskRow(), error: null }, 'single'),
      );

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Task',
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
        },
        user('admin'),
      ),
    ).resolves.toMatchObject({ id: TASK_ID });
  });

  it('returns PROJECT_NOT_FOUND for a missing project', async () => {
    client.from.mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.getTasks(PROJECT_ID, { page: 1, pageSize: 20 }, user('employee')),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('allows a project_manager to create and update tasks', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult({ data: { project_role: 'project_manager' } }),
      )
      .mockReturnValueOnce(
        queryResult({ data: taskRow(), error: null }, 'single'),
      );

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Managed task',
          status: 'todo',
          priority: 'high',
          sortOrder: 0,
        },
        user('team_leader'),
      ),
    ).resolves.toMatchObject({ id: TASK_ID });

    client.from.mockReset();
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult({ data: { project_role: 'project_manager' } }),
      )
      .mockReturnValueOnce(queryResult({ data: taskRow() }))
      .mockReturnValueOnce(
        queryResult(
          { data: taskRow({ priority: 'urgent' }), error: null },
          'single',
        ),
      );

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { priority: 'urgent' },
        user('team_leader'),
      ),
    ).resolves.toMatchObject({ priority: 'urgent' });
  });

  it('does not infer PM mutation rights from the global team_leader role', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { project_role: 'member' } }));

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Denied task',
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
        },
        user('team_leader'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an assignee who is not a project member', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Task',
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
          assigneeUserId: ASSIGNEE_ID,
        },
        user('admin'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER' },
    });
  });

  it('allows an assignee who is a project member', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { id: 'member' } }))
      .mockReturnValueOnce(
        queryResult({ data: taskRow(), error: null }, 'single'),
      );

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Task',
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
          assigneeUserId: ASSIGNEE_ID,
        },
        user('admin'),
      ),
    ).resolves.toMatchObject({ assignee_user_id: ASSIGNEE_ID });
  });

  it('allows a parent task from the same project', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult({ data: { id: TASK_ID, project_id: PROJECT_ID } }),
      )
      .mockReturnValueOnce(
        queryResult({ data: taskRow(), error: null }, 'single'),
      );

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Child',
          parentTaskId: TASK_ID,
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
        },
        user('admin'),
      ),
    ).resolves.toMatchObject({ id: TASK_ID });
  });

  it('rejects a parent task from another project', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult({ data: { id: TASK_ID, project_id: OTHER_PROJECT_ID } }),
      );

    await expect(
      service.createTask(
        PROJECT_ID,
        {
          title: 'Child',
          parentTaskId: TASK_ID,
          status: 'todo',
          priority: 'medium',
          sortOrder: 0,
        },
        user('admin'),
      ),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_PARENT_TASK_PROJECT' },
    });
  });

  it('rejects making a task its own parent', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: taskRow() }));

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { parentTaskId: TASK_ID },
        user('admin'),
      ),
    ).rejects.toMatchObject({ response: { code: 'TASK_SELF_PARENT_DENIED' } });
  });

  it('allows a project member to read the task list with DB pagination', async () => {
    const listQuery = queryResult(
      { data: [taskRow()], count: 1, error: null },
      'range',
    );
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { project_role: 'member' } }))
      .mockReturnValueOnce(listQuery);

    const result = await service.getTasks(
      PROJECT_ID,
      { page: 2, pageSize: 10 },
      user('employee'),
    );

    expect(listQuery.range).toHaveBeenCalledWith(10, 19);
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 });
  });

  it('denies task reads to non-members and clients', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.getTasks(PROJECT_ID, { page: 1, pageSize: 20 }, user('employee')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    client.from.mockReset();
    client.from.mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }));
    await expect(
      service.getTasks(PROJECT_ID, { page: 1, pageSize: 20 }, user('client')),
    ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });
  });

  it('lets the assigned employee change status only', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { project_role: 'member' } }))
      .mockReturnValueOnce(
        queryResult({ data: taskRow({ assignee_user_id: USER_ID }) }),
      )
      .mockReturnValueOnce(
        queryResult(
          { data: taskRow({ assignee_user_id: USER_ID, status: 'done' }) },
          'single',
        ),
      );

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        user('employee'),
      ),
    ).resolves.toMatchObject({ status: 'done' });

    client.from.mockReset();
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { project_role: 'member' } }))
      .mockReturnValueOnce(
        queryResult({ data: taskRow({ assignee_user_id: USER_ID }) }),
      );

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { assigneeUserId: ASSIGNEE_ID },
        user('employee'),
      ),
    ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });
  });
});
