import { ForbiddenException } from '@nestjs/common';
import { WorkflowAutoTaskScheduler } from './workflow-auto-task.scheduler';
import { WorkflowRuntimeService } from './workflow-runtime.service';

type Call = { method: string; args: unknown[] };
type Response = { data?: unknown; count?: number | null; error?: unknown };

/** Chainable, thenable stand-in for a Supabase query builder. */
function fakeClient(
  respond: (table: string, calls: Call[]) => Response,
  log: Array<{ table: string; calls: Call[] }> = [],
) {
  return {
    log,
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'in',
        'gt',
        'order',
        'limit',
        'range',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: Response) => unknown) => {
        log.push({ table, calls });
        return resolve({ error: null, ...respond(table, calls) });
      };
      return builder;
    },
  };
}

function buildRuntime(client: unknown) {
  return new WorkflowRuntimeService(
    { getSystemClient: jest.fn().mockReturnValue(client) } as never,
    { createTask: jest.fn() } as never,
    { calculateDueAt: jest.fn() } as never,
  );
}

type Internals = {
  autoTaskActors: jest.Mock;
  ensureReadyAutoTasks: jest.Mock;
  createAutoTasksAsSystem: jest.Mock;
};

const actor = (profileId: string, role = 'team_leader') =>
  ({ profileId, role }) as never;

describe('WorkflowAutoTaskScheduler', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('does not start a timer under APP_ENV=test or when disabled', () => {
    const sweep = jest.fn();
    process.env.APP_ENV = 'test';
    const test = new WorkflowAutoTaskScheduler({
      sweepMissingAutoTasks: sweep,
    } as never);
    test.onModuleInit();
    expect((test as unknown as { timer: unknown }).timer).toBeNull();

    process.env.APP_ENV = 'development';
    process.env.WORKFLOW_AUTOTASK_SWEEP_MS = '0';
    const off = new WorkflowAutoTaskScheduler({
      sweepMissingAutoTasks: sweep,
    } as never);
    off.onModuleInit();
    expect((off as unknown as { timer: unknown }).timer).toBeNull();
  });

  it('sweeps on the configured interval and stops on destroy', async () => {
    jest.useFakeTimers();
    process.env.APP_ENV = 'development';
    process.env.WORKFLOW_AUTOTASK_SWEEP_MS = '1000';
    const sweep = jest.fn().mockResolvedValue({ workflows: 0 });
    const scheduler = new WorkflowAutoTaskScheduler({
      sweepMissingAutoTasks: sweep,
    } as never);
    scheduler.onModuleInit();

    await jest.advanceTimersByTimeAsync(2500);
    expect(sweep).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it('never runs two sweeps at once and survives a failing sweep', async () => {
    let release: () => void = () => undefined;
    const sweep = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ workflows: 1 });
          }),
      )
      .mockRejectedValueOnce(new Error('db down'));
    const scheduler = new WorkflowAutoTaskScheduler({
      sweepMissingAutoTasks: sweep,
    } as never);

    const first = scheduler.tick();
    await scheduler.tick(); // skipped: the first run is still active
    expect(sweep).toHaveBeenCalledTimes(1);
    release();
    await first;

    await expect(scheduler.tick()).resolves.toBeUndefined(); // error swallowed
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});

describe('createAutoTasksAsSystem', () => {
  it('uses the project manager first and stops at the first success', async () => {
    const service = buildRuntime(fakeClient(() => ({ data: [] })));
    const internals = service as unknown as Internals;
    internals.autoTaskActors = jest
      .fn()
      .mockResolvedValue([actor('pm-1'), actor('admin-1', 'admin')]);
    internals.ensureReadyAutoTasks = jest.fn().mockResolvedValue(undefined);

    await service.createAutoTasksAsSystem('project-1', 'workflow-1');

    expect(internals.ensureReadyAutoTasks).toHaveBeenCalledTimes(1);
    expect(internals.ensureReadyAutoTasks).toHaveBeenCalledWith(
      'project-1',
      'workflow-1',
      expect.objectContaining({ profileId: 'pm-1' }),
    );
  });

  it('falls back to the admin when the project manager is not allowed', async () => {
    const service = buildRuntime(fakeClient(() => ({ data: [] })));
    const internals = service as unknown as Internals;
    internals.autoTaskActors = jest
      .fn()
      .mockResolvedValue([actor('pm-1'), actor('admin-1', 'admin')]);
    internals.ensureReadyAutoTasks = jest
      .fn()
      .mockRejectedValueOnce(new ForbiddenException('not a member'))
      .mockResolvedValueOnce(undefined);

    await service.createAutoTasksAsSystem('project-1', 'workflow-1');

    expect(internals.ensureReadyAutoTasks).toHaveBeenCalledTimes(2);
    expect(internals.ensureReadyAutoTasks).toHaveBeenLastCalledWith(
      'project-1',
      'workflow-1',
      expect.objectContaining({ profileId: 'admin-1' }),
    );
  });

  it('does not hide real failures and does nothing without an owner', async () => {
    const service = buildRuntime(fakeClient(() => ({ data: [] })));
    const internals = service as unknown as Internals;
    internals.autoTaskActors = jest.fn().mockResolvedValue([actor('pm-1')]);
    internals.ensureReadyAutoTasks = jest
      .fn()
      .mockRejectedValue(new Error('database exploded'));
    await expect(
      service.createAutoTasksAsSystem('project-1', 'workflow-1'),
    ).rejects.toThrow('database exploded');

    internals.autoTaskActors = jest.fn().mockResolvedValue([]);
    internals.ensureReadyAutoTasks = jest.fn();
    await service.createAutoTasksAsSystem('project-1', 'workflow-1');
    expect(internals.ensureReadyAutoTasks).not.toHaveBeenCalled();
  });
});

describe('sweepMissingAutoTasks', () => {
  it('creates tasks only for workflows that still have a ready item without a primary task', async () => {
    const client = fakeClient((table) => {
      if (table === 'project_workflow_stage_items') {
        return {
          data: [
            {
              id: 'item-1',
              project_workflow_id: 'wf-missing',
              links: [],
            },
            {
              id: 'item-2',
              project_workflow_id: 'wf-done',
              links: [{ link_type: 'primary' }],
            },
            {
              id: 'item-3',
              project_workflow_id: 'wf-closed',
              links: [{ link_type: 'secondary' }],
            },
          ],
        };
      }
      return {
        data: [
          { id: 'wf-missing', project_id: 'project-1', status: 'in_progress' },
          { id: 'wf-closed', project_id: 'project-2', status: 'completed' },
        ],
      };
    });
    const service = buildRuntime(client);
    const internals = service as unknown as Internals;
    internals.createAutoTasksAsSystem = jest.fn().mockResolvedValue(undefined);

    const result = await service.sweepMissingAutoTasks();

    expect(result).toEqual({ workflows: 1 });
    expect(internals.createAutoTasksAsSystem).toHaveBeenCalledTimes(1);
    expect(internals.createAutoTasksAsSystem).toHaveBeenCalledWith(
      'project-1',
      'wf-missing',
    );
    const workflowLookup = client.log.find(
      (entry) => entry.table === 'project_workflows',
    );
    expect(
      workflowLookup?.calls.find((call) => call.method === 'in')?.args,
    ).toEqual(['id', ['wf-missing', 'wf-closed']]);
  });

  it('keeps sweeping the other workflows when one fails', async () => {
    const client = fakeClient((table) =>
      table === 'project_workflow_stage_items'
        ? {
            data: [
              { id: 'a', project_workflow_id: 'wf-1', links: [] },
              { id: 'b', project_workflow_id: 'wf-2', links: [] },
            ],
          }
        : {
            data: [
              { id: 'wf-1', project_id: 'p1', status: 'in_progress' },
              { id: 'wf-2', project_id: 'p2', status: 'in_progress' },
            ],
          },
    );
    const service = buildRuntime(client);
    const internals = service as unknown as Internals;
    internals.createAutoTasksAsSystem = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await expect(service.sweepMissingAutoTasks()).resolves.toEqual({
      workflows: 1,
    });
    expect(internals.createAutoTasksAsSystem).toHaveBeenCalledTimes(2);
  });

  describe('with more ready items than one query returns', () => {
    const itemId = (n: number) => `item-${String(n).padStart(4, '0')}`;
    /** 450 ready auto-task items; only #430-#432 still lack a primary task. */
    const allItems = Array.from({ length: 450 }, (_, n) => ({
      id: itemId(n),
      project_workflow_id: n >= 430 && n <= 432 ? 'wf-late' : 'wf-ok',
      links: n >= 430 && n <= 432 ? [] : [{ link_type: 'primary' }],
    }));

    function pagedClient() {
      return fakeClient((table, calls) => {
        if (table === 'project_workflow_stage_items') {
          const after = calls.find((call) => call.method === 'gt')?.args[1];
          const limit = Number(
            calls.find((call) => call.method === 'limit')?.args[0],
          );
          const remaining = allItems.filter(
            (item) => typeof after !== 'string' || item.id > after,
          );
          return { data: remaining.slice(0, limit) };
        }
        return {
          data: [
            {
              id: 'wf-late',
              project_id: 'project-late',
              status: 'in_progress',
            },
          ],
        };
      });
    }

    it('finds missing items beyond the first 200 and the second page', async () => {
      const client = pagedClient();
      const service = buildRuntime(client);
      const internals = service as unknown as Internals;
      internals.createAutoTasksAsSystem = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(service.sweepMissingAutoTasks(200)).resolves.toEqual({
        workflows: 1,
      });

      expect(internals.createAutoTasksAsSystem).toHaveBeenCalledTimes(1);
      expect(internals.createAutoTasksAsSystem).toHaveBeenCalledWith(
        'project-late',
        'wf-late',
      );
      const pages = client.log.filter(
        (entry) => entry.table === 'project_workflow_stage_items',
      );
      expect(pages).toHaveLength(3); // 200 + 200 + 50
      expect(
        pages.map(
          (entry) => entry.calls.find((call) => call.method === 'gt')?.args[1],
        ),
      ).toEqual([undefined, itemId(199), itemId(399)]);
    });

    it('stops after maxPages so one sweep stays bounded', async () => {
      const client = pagedClient();
      const service = buildRuntime(client);
      const internals = service as unknown as Internals;
      internals.createAutoTasksAsSystem = jest
        .fn()
        .mockResolvedValue(undefined);

      // 2 pages x 200 = 400 items scanned: the late items (#430+) stay for the next sweep.
      await expect(service.sweepMissingAutoTasks(200, 2)).resolves.toEqual({
        workflows: 0,
      });
      expect(internals.createAutoTasksAsSystem).not.toHaveBeenCalled();
    });

    it('recovers after an incident: a failed run is retried by the next sweep', async () => {
      const service = buildRuntime(pagedClient());
      const internals = service as unknown as Internals;
      internals.createAutoTasksAsSystem = jest
        .fn()
        .mockRejectedValueOnce(new Error('database restarting'))
        .mockResolvedValueOnce(undefined);

      await expect(service.sweepMissingAutoTasks(200)).resolves.toEqual({
        workflows: 0,
      });
      await expect(service.sweepMissingAutoTasks(200)).resolves.toEqual({
        workflows: 1,
      });
      expect(internals.createAutoTasksAsSystem).toHaveBeenCalledTimes(2);
    });
  });
});

describe('listClientApprovals', () => {
  const query = { status: 'pending' as const, page: 2, pageSize: 20 };

  it('returns an empty page when the client belongs to no company', async () => {
    const service = buildRuntime(
      fakeClient((table) =>
        table === 'client_memberships' ? { data: [] } : { data: [] },
      ),
    );

    await expect(service.listClientApprovals('user-1', query)).resolves.toEqual(
      {
        items: [],
        page: 2,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        counts: { pending: 0, approved: 0, rejected: 0 },
      },
    );
  });

  it('paginates server-side, scopes to the client and exposes no internal notes', async () => {
    const client = fakeClient((table, calls) => {
      if (table === 'client_memberships') {
        return { data: [{ client_company_id: 'company-1' }] };
      }
      if (table === 'projects') {
        return { data: [{ id: 'p1', project_code: 'DA_01', name: 'Website' }] };
      }
      if (table === 'workflow_approval_requests') {
        const select = calls.find((call) => call.method === 'select');
        if ((select?.args[1] as { head?: boolean } | undefined)?.head) {
          const status = calls.find(
            (call) => call.method === 'eq' && call.args[0] === 'status',
          )?.args[1];
          return {
            count: status === 'pending' ? 45 : status === 'approved' ? 3 : 1,
          };
        }
        return {
          data: [
            {
              id: 'ap-21',
              status: 'pending',
              requested_at: '2026-10-19T01:00:00Z',
              responded_at: null,
              project_id: 'p1',
              project_workflow_id: 'wf-1',
              project_workflow_stage_id: null,
              project_workflow_stage_item_id: 'item-1',
            },
          ],
        };
      }
      if (table === 'project_workflow_stage_items') {
        return {
          data: [
            {
              id: 'item-1',
              project_workflow_stage_id: 'stage-1',
              project_service_item: { name: 'Banner trang chủ' },
            },
          ],
        };
      }
      return { data: [{ id: 'stage-1', name_snapshot: 'Thiết kế giao diện' }] };
    }, []);
    const service = buildRuntime(client);

    const page = await service.listClientApprovals('user-1', query);

    expect(page.counts).toEqual({ pending: 45, approved: 3, rejected: 1 });
    expect(page.total).toBe(45);
    expect(page.totalPages).toBe(3);
    expect(page.items).toEqual([
      {
        id: 'ap-21',
        status: 'pending',
        requestedAt: '2026-10-19T01:00:00Z',
        respondedAt: null,
        projectId: 'p1',
        projectCode: 'DA_01',
        projectName: 'Website',
        workflowId: 'wf-1',
        stageName: 'Thiết kế giao diện',
        itemName: 'Banner trang chủ',
      },
    ]);
    const list = client.log
      .filter((entry) => entry.table === 'workflow_approval_requests')
      .find(
        (entry) =>
          !(
            entry.calls.find((call) => call.method === 'select')?.args[1] as
              { head?: boolean } | undefined
          )?.head,
      );
    expect(list?.calls.find((call) => call.method === 'range')?.args).toEqual([
      20, 39,
    ]);
    expect(list?.calls.find((call) => call.method === 'in')?.args).toEqual([
      'project_id',
      ['p1'],
    ]);
    expect(
      list?.calls.some(
        (call) =>
          call.method === 'eq' &&
          call.args[0] === 'approval_type' &&
          call.args[1] === 'client',
      ),
    ).toBe(true);
    expect(JSON.stringify(page)).not.toMatch(/request_note|decision_note/);
  });

  it('returns no rows (but real counts) when the page is past the end', async () => {
    const service = buildRuntime(
      fakeClient((table, calls) => {
        if (table === 'client_memberships') {
          return { data: [{ client_company_id: 'company-1' }] };
        }
        if (table === 'projects') {
          return {
            data: [{ id: 'p1', project_code: 'DA_01', name: 'Website' }],
          };
        }
        const select = calls.find((call) => call.method === 'select');
        if ((select?.args[1] as { head?: boolean } | undefined)?.head) {
          return { count: 5 };
        }
        throw new Error('the list query must not run for an out-of-range page');
      }),
    );

    const page = await service.listClientApprovals('user-1', {
      ...query,
      page: 9,
    });

    expect(page.items).toEqual([]);
    expect(page.total).toBe(5);
    expect(page.totalPages).toBe(1);
  });
});
