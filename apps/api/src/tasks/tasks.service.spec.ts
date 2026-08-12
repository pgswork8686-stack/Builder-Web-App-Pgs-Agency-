import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from './tasks.service';
import type { WorkspaceRealtimeGateway } from '../workspace/workspace-realtime.gateway';

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
  let client: { from: jest.Mock; rpc: jest.Mock };
  let realtime: { emitProjectEvent: jest.Mock };

  beforeEach(() => {
    client = { from: jest.fn(), rpc: jest.fn() };
    realtime = { emitProjectEvent: jest.fn() };
    service = new TasksService(
      {
        getSystemClient: () => client,
      } as unknown as SupabaseService,
      realtime as unknown as WorkspaceRealtimeGateway,
    );
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
    expect(realtime.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'task.created', entityId: TASK_ID }),
    );
  });

  it('does not roll back a created task when realtime broadcast fails', async () => {
    realtime.emitProjectEvent.mockImplementationOnce(() => {
      throw new Error('socket unavailable');
    });
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(
        queryResult(
          {
            data: taskRow({ updated_at: '2026-08-11T10:00:00.000Z' }),
            error: null,
          },
          'single',
        ),
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
      .mockReturnValueOnce(
        queryResult({
          data: {
            id: 'member',
            profile: { role: 'employee', account_status: 'active' },
          },
        }),
      )
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

  it.each([
    ['client', { role: 'client', account_status: 'active' }],
    ['inactive employee', { role: 'employee', account_status: 'pending' }],
  ])('rejects %s as a task assignee', async (_label, profile) => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }))
      .mockReturnValueOnce(queryResult({ data: { id: 'member', profile } }));

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
      response: { code: 'TASK_ASSIGNEE_INVALID_USER' },
    });
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
      );
    client.rpc.mockResolvedValueOnce({
      data: taskRow({ assignee_user_id: USER_ID, status: 'done' }),
      error: null,
    });

    await expect(
      service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { status: 'done' },
        user('employee'),
      ),
    ).resolves.toMatchObject({ status: 'done' });
    expect(client.rpc).toHaveBeenCalledWith('phase4_update_task_atomic', {
      p_project_id: PROJECT_ID,
      p_task_id: TASK_ID,
      p_actor_user_id: USER_ID,
      p_set_parent_task: false,
      p_parent_task_id: null,
      p_set_title: false,
      p_title: null,
      p_set_description: false,
      p_description: null,
      p_set_status: true,
      p_status: 'done',
      p_set_priority: false,
      p_priority: null,
      p_set_assignee: false,
      p_assignee_user_id: null,
      p_set_start_date: false,
      p_start_date: null,
      p_set_due_date: false,
      p_due_date: null,
    });

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

  describe('Atomic Task Updates', () => {
    it('calls the atomic RPC instead of a normal tasks table update for mixed PATCH (title + status)', async () => {
      const updateSpy = jest.fn();
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return queryResult({ data: { id: PROJECT_ID } });
        }
        if (table === 'project_memberships') {
          return queryResult({ data: { project_role: 'project_manager' } });
        }
        if (table === 'tasks') {
          const q = queryResult({ data: taskRow() });
          q.update = updateSpy.mockReturnValue(q);
          return q;
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: taskRow({ title: 'New Title', status: 'review' }),
        error: null,
      });

      const res = await service.updateTask(
        PROJECT_ID,
        TASK_ID,
        { title: 'New Title', status: 'review' },
        user('team_leader'),
      );

      expect(res).toMatchObject({ title: 'New Title', status: 'review' });
      expect(client.rpc).toHaveBeenCalledWith(
        'phase4_update_task_atomic',
        expect.objectContaining({
          p_project_id: PROJECT_ID,
          p_task_id: TASK_ID,
          p_set_title: true,
          p_title: 'New Title',
          p_set_status: true,
          p_status: 'review',
        }),
      );

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('proves that if mixed RPC fails, no normal update has been executed', async () => {
      const updateSpy = jest.fn();
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return queryResult({ data: { id: PROJECT_ID } });
        }
        if (table === 'project_memberships') {
          return queryResult({ data: { project_role: 'project_manager' } });
        }
        if (table === 'tasks') {
          const q = queryResult({ data: taskRow() });
          q.update = updateSpy.mockReturnValue(q);
          return q;
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Some RPC error' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { title: 'New Title', status: 'review' },
          user('team_leader'),
        ),
      ).rejects.toThrow();

      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Viewer RBAC and Safe Error Mapping', () => {
    it('denies task updates to viewer who is assigned to task', async () => {
      const updateSpy = jest.fn();
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'viewer' } });
        if (table === 'tasks') {
          const q = queryResult({
            data: taskRow({ assignee_user_id: USER_ID }),
          });
          q.update = updateSpy.mockReturnValue(q);
          return q;
        }
        return queryResult({});
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('employee'),
        ),
      ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });

      expect(client.rpc).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('denies mixed updates to viewer', async () => {
      const updateSpy = jest.fn();
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'viewer' } });
        if (table === 'tasks') {
          const q = queryResult({
            data: taskRow({ assignee_user_id: USER_ID }),
          });
          q.update = updateSpy.mockReturnValue(q);
          return q;
        }
        return queryResult({});
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { title: 'New title', status: 'done' },
          user('employee'),
        ),
      ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });

      expect(client.rpc).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('denies status updates to viewer who is not assigned', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'viewer' } });
        if (table === 'tasks')
          return queryResult({
            data: taskRow({ assignee_user_id: ASSIGNEE_ID }),
          });
        return queryResult({});
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('employee'),
        ),
      ).rejects.toMatchObject({ response: { code: 'TASK_ACCESS_DENIED' } });
    });

    it('maps TASK_PROJECT_CHANGED to safe TASK_NOT_FOUND', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'project_manager' } });
        if (table === 'tasks') return queryResult({ data: taskRow() });
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'TASK_PROJECT_CHANGED', code: 'P4031' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('team_leader'),
        ),
      ).rejects.toMatchObject({ response: { code: 'TASK_NOT_FOUND' } });
    });

    it('maps INVALID_TASK_DATE_RANGE correctly', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'project_manager' } });
        if (table === 'tasks') return queryResult({ data: taskRow() });
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'INVALID_TASK_DATE_RANGE', code: 'P4037' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('team_leader'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TASK_DATE_RANGE' },
      });
    });

    it('maps TASK_ASSIGNEE_INVALID_USER correctly when code is P4033', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'project_manager' } });
        if (table === 'tasks') return queryResult({ data: taskRow() });
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'TASK_ASSIGNEE_INVALID_USER', code: 'P4033' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('team_leader'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'TASK_ASSIGNEE_INVALID_USER' },
      });
    });

    it('maps TASK_ORDERING_RPC_REQUIRED correctly when code is P4033 to TASK_WRITE_FAILED', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'project_manager' } });
        if (table === 'tasks') return queryResult({ data: taskRow() });
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'TASK_ORDERING_RPC_REQUIRED', code: 'P4033' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('team_leader'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'TASK_WRITE_FAILED' },
      });
    });

    it('maps TASK_ASSIGNEE_NOT_PROJECT_MEMBER correctly', async () => {
      client.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'projects')
          return queryResult({ data: { id: PROJECT_ID } });
        if (table === 'project_memberships')
          return queryResult({ data: { project_role: 'project_manager' } });
        if (table === 'tasks') return queryResult({ data: taskRow() });
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER' },
      });

      await expect(
        service.updateTask(
          PROJECT_ID,
          TASK_ID,
          { status: 'done' },
          user('team_leader'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'TASK_ASSIGNEE_NOT_PROJECT_MEMBER' },
      });
    });
  });
});
