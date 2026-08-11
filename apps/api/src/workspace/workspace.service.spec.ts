import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import type { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';
import { WorkspaceService } from './workspace.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function user(): RequestUser {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: null,
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: null,
    avatarUrl: null,
    approvedAt: null,
  };
}

function queryResult(result: Record<string, unknown>) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'eq', 'in', 'ilike', 'or', 'order']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.range = jest.fn().mockResolvedValue(result);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

describe('WorkspaceService', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let access: {
    requireProjectAccess: jest.Mock;
    requireTask: jest.Mock;
  };
  let realtime: { emitProjectEvent: jest.Mock };
  let service: WorkspaceService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    access = {
      requireProjectAccess: jest.fn().mockResolvedValue({
        isAdmin: false,
        isManager: true,
        projectRole: 'project_manager',
      }),
      requireTask: jest.fn().mockResolvedValue({
        id: TASK_ID,
        project_id: PROJECT_ID,
      }),
    };
    realtime = { emitProjectEvent: jest.fn() };
    service = new WorkspaceService(
      {
        getSystemClient: () => ({ from, rpc }),
      } as unknown as SupabaseService,
      access as unknown as WorkspaceAccessService,
      realtime as unknown as WorkspaceRealtimeGateway,
    );
  });

  it('loads at most 500 active board tasks and reports truncation', async () => {
    const query = queryResult({
      data: [
        {
          id: TASK_ID,
          status: 'todo',
          assignee_user_id: USER_ID,
        },
      ],
      count: 501,
      error: null,
    });
    from.mockReturnValueOnce(query);
    const result = await service.getBoard(PROJECT_ID, {}, user());
    expect(query.range).toHaveBeenCalledWith(0, 499);
    expect(result).toMatchObject({ truncated: true, total: 501, limit: 500 });
    expect(result.todo[0]).toMatchObject({ canReorder: true });
  });

  it('filters calendar tasks in the database', async () => {
    const query = queryResult({
      data: [
        {
          id: TASK_ID,
          title: 'Due task',
          status: 'todo',
          priority: 'high',
          start_date: null,
          due_date: '2026-08-12',
        },
      ],
      error: null,
    });
    from.mockReturnValueOnce(query);
    const result = await service.getCalendar(
      PROJECT_ID,
      { from: '2026-08-01', to: '2026-08-31' },
      user(),
    );
    expect(query.or).toHaveBeenCalledWith(
      expect.stringContaining('due_date.gte.2026-08-01'),
    );
    expect(result).toEqual([
      expect.objectContaining({ taskId: TASK_ID, dueDate: '2026-08-12' }),
    ]);
  });

  it('denies arbitrary reorder to a normal member', async () => {
    access.requireProjectAccess.mockResolvedValueOnce({
      isAdmin: false,
      isManager: false,
      projectRole: 'member',
    });
    await expect(
      service.moveTask(PROJECT_ID, TASK_ID, { status: 'done' }, user()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('moves through the atomic RPC and emits only after success', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: TASK_ID,
        status: 'done',
        sort_order: 1000,
        updated_at: '2026-08-11T10:00:00.000Z',
      },
      error: null,
    });
    await expect(
      service.moveTask(PROJECT_ID, TASK_ID, { status: 'done' }, user()),
    ).resolves.toMatchObject({ status: 'done' });
    expect(rpc).toHaveBeenCalledWith(
      'move_task_on_board',
      expect.objectContaining({ p_task_id: TASK_ID, p_target_status: 'done' }),
    );
    expect(realtime.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'task.moved', entityId: TASK_ID }),
    );
  });

  it('keeps a successful move when realtime broadcasting fails', async () => {
    rpc.mockResolvedValueOnce({
      data: { id: TASK_ID, status: 'review', updated_at: 'now' },
      error: null,
    });
    realtime.emitProjectEvent.mockImplementationOnce(() => {
      throw new Error('socket unavailable');
    });
    await expect(
      service.moveTask(PROJECT_ID, TASK_ID, { status: 'review' }, user()),
    ).resolves.toMatchObject({ status: 'review' });
  });
});
