import { HANDOVER_CATEGORY, HandoverService } from './handover.service';

type Call = { method: string; args: unknown[] };
type Resp = { data?: unknown; count?: number | null; error?: unknown };

const PROJECT_ID = 'project-1';
const FILE_ID = 'file-1';

function actor(role: string, profileId = 'user-1') {
  return { profileId, role, fullName: 'Người dùng' } as never;
}

/** Table-aware, chainable and thenable stand-in for the Supabase client. */
function setup(options: {
  files?: Array<Record<string, unknown>>;
  memberships?: unknown[];
  projects?: unknown[];
  isManager?: boolean;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const log: Array<{ table: string; calls: Call[] }> = [];
  const file = options.files?.[0];
  const handlers: Record<string, (calls: Call[]) => Resp> = {
    project_files: (calls) =>
      calls.some((call) => call.method === 'maybeSingle')
        ? { data: file ?? null }
        : { data: options.files ?? [], count: options.files?.length ?? 0 },
    client_memberships: () => ({ data: options.memberships ?? [] }),
    projects: (calls) =>
      calls.some((call) => call.method === 'maybeSingle')
        ? {
            data: {
              project_code: 'DA_07',
              name: 'Website Hồ Mộc',
              client_company_id: 'company-1',
            },
          }
        : { data: options.projects ?? [] },
  };
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/x' },
    error: null,
  });
  const client = {
    storage: { from: () => ({ createSignedUrl }) },
    from(table: string) {
      const calls: Call[] = [];
      const builder: Record<string, unknown> = {};
      for (const method of [
        'select',
        'eq',
        'in',
        'order',
        'range',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder.update = (row: Record<string, unknown>) => {
        updates.push(row);
        calls.push({ method: 'update', args: [row] });
        return builder;
      };
      builder.then = (resolve: (value: Resp) => unknown) => {
        log.push({ table, calls });
        return resolve({ error: null, ...(handlers[table]?.(calls) ?? {}) });
      };
      return builder;
    },
  };
  const createForUsers = jest.fn().mockResolvedValue([]);
  const service = new HandoverService(
    { getSystemClient: () => client } as never,
    {
      requireProjectAccess: jest
        .fn()
        .mockResolvedValue({ isManager: options.isManager ?? true }),
    } as never,
    { createForUsers } as never,
  );
  return { service, updates, log, createForUsers, createSignedUrl };
}

const plainFile = (overrides: Record<string, unknown> = {}) => ({
  id: FILE_ID,
  project_id: PROJECT_ID,
  original_name: 'ban-giao.pdf',
  file_category: null,
  delete_status: 'active',
  storage_path: 'projects/p/2026/10/x.pdf',
  ...overrides,
});

describe('HandoverService - marking files (internal side)', () => {
  it('lets only a manager hand a file over', async () => {
    const { service, updates } = setup({
      files: [plainFile()],
      isManager: false,
    });

    await expect(
      service.setHandover(PROJECT_ID, FILE_ID, true, actor('employee')),
    ).rejects.toMatchObject({ response: { code: 'FILE_ACCESS_DENIED' } });
    expect(updates).toEqual([]);
  });

  it('marks the file, notifies the active client members, and is idempotent', async () => {
    const first = setup({
      files: [plainFile()],
      memberships: [
        { user_id: 'client-1', profile: { account_status: 'active' } },
        { user_id: 'client-2', profile: [{ account_status: 'pending' }] },
      ],
    });
    await expect(
      first.service.setHandover(
        PROJECT_ID,
        FILE_ID,
        true,
        actor('team_leader', 'leader-1'),
      ),
    ).resolves.toEqual({ id: FILE_ID, clientVisible: true, changed: true });
    expect(first.updates).toEqual([{ file_category: HANDOVER_CATEGORY }]);
    const [recipients, input] = first.createForUsers.mock.calls[0];
    expect(recipients).toEqual(['client-1']);
    expect(input).toMatchObject({
      type: 'project.handover_document',
      actionUrl: '/app/client/documents',
      actorUserId: 'leader-1',
    });
    expect(input.message).toContain('ban-giao.pdf');

    const again = setup({
      files: [plainFile({ file_category: HANDOVER_CATEGORY })],
    });
    await expect(
      again.service.setHandover(PROJECT_ID, FILE_ID, true, actor('admin')),
    ).resolves.toEqual({ id: FILE_ID, clientVisible: true, changed: false });
    expect(again.updates).toEqual([]);
    expect(again.createForUsers).not.toHaveBeenCalled();
  });

  it('withdraws a handover only when the file is actually handed over', async () => {
    const handed = setup({
      files: [plainFile({ file_category: HANDOVER_CATEGORY })],
    });
    await handed.service.setHandover(
      PROJECT_ID,
      FILE_ID,
      false,
      actor('admin'),
    );
    expect(handed.updates).toEqual([{ file_category: null }]);
    expect(handed.createForUsers).not.toHaveBeenCalled();

    const other = setup({ files: [plainFile({ file_category: 'invoice' })] });
    await expect(
      other.service.setHandover(PROJECT_ID, FILE_ID, false, actor('admin')),
    ).resolves.toMatchObject({ changed: false });
    expect(other.updates).toEqual([]);
  });

  it('refuses files of another project and deleted files', async () => {
    const foreign = setup({
      files: [plainFile({ project_id: 'other-project' })],
    });
    await expect(
      foreign.service.setHandover(PROJECT_ID, FILE_ID, true, actor('admin')),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });

    const deleted = setup({ files: [plainFile({ delete_status: 'deleted' })] });
    await expect(
      deleted.service.setHandover(PROJECT_ID, FILE_ID, true, actor('admin')),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
  });
});

describe('HandoverService - client side', () => {
  const memberships = [{ client_company_id: 'company-1' }];
  const projects = [
    {
      id: PROJECT_ID,
      project_code: 'DA_07',
      name: 'Website',
      status: 'completed',
    },
  ];

  it('is for clients only', async () => {
    const { service } = setup({});
    await expect(
      service.listForClient(actor('employee'), { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ response: { code: 'HANDOVER_ACCESS_DENIED' } });
    await expect(
      service.downloadForClient(FILE_ID, actor('team_leader')),
    ).rejects.toMatchObject({ response: { code: 'HANDOVER_ACCESS_DENIED' } });
  });

  it('lists only handed-over, active files of the client company, paginated, with no storage path', async () => {
    const { service, log } = setup({
      memberships,
      projects,
      files: [
        {
          id: FILE_ID,
          project_id: PROJECT_ID,
          original_name: 'ban-giao.pdf',
          mime_type: 'application/pdf',
          size_bytes: '2048',
          updated_at: '2026-10-19T03:00:00Z',
          storage_path: 'SECRET/path',
        },
      ],
    });

    const result = await service.listForClient(actor('client'), {
      page: 2,
      pageSize: 10,
    });

    expect(result.items).toEqual([
      {
        id: FILE_ID,
        projectId: PROJECT_ID,
        projectCode: 'DA_07',
        projectName: 'Website',
        projectStatus: 'completed',
        originalName: 'ban-giao.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        handedOverAt: '2026-10-19T03:00:00Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('SECRET');
    const files = log.find((entry) => entry.table === 'project_files');
    const calls = files!.calls;
    expect(calls.find((c) => c.method === 'in')?.args).toEqual([
      'project_id',
      [PROJECT_ID],
    ]);
    expect(
      calls.some(
        (c) =>
          c.method === 'eq' &&
          c.args[0] === 'file_category' &&
          c.args[1] === HANDOVER_CATEGORY,
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === 'eq' &&
          c.args[0] === 'delete_status' &&
          c.args[1] === 'active',
      ),
    ).toBe(true);
    expect(calls.find((c) => c.method === 'range')?.args).toEqual([10, 19]);
  });

  it('returns nothing for a client without a company and 404 for a foreign project filter', async () => {
    const none = setup({});
    await expect(
      none.service.listForClient(actor('client'), { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ items: [], total: 0 });

    const scoped = setup({ memberships, projects });
    await expect(
      scoped.service.listForClient(actor('client'), {
        page: 1,
        pageSize: 20,
        projectId: 'someone-elses-project',
      }),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_FOUND' } });
  });

  it('downloads a handed-over file through a short-lived signed URL', async () => {
    const { service, createSignedUrl } = setup({
      memberships,
      projects,
      files: [
        plainFile({
          file_category: HANDOVER_CATEGORY,
          original_name: 'a"b/c.pdf',
        }),
      ],
    });

    await expect(
      service.downloadForClient(FILE_ID, actor('client')),
    ).resolves.toEqual({
      signedUrl: 'https://signed.example/x',
      expiresIn: 120,
    });
    expect(createSignedUrl).toHaveBeenCalledWith(
      'projects/p/2026/10/x.pdf',
      120,
      {
        download: 'a-b-c.pdf',
      },
    );
  });

  it('answers 404 for files that are not handed over, deleted, or not theirs (no probing)', async () => {
    for (const file of [
      plainFile({ file_category: null }),
      plainFile({ file_category: HANDOVER_CATEGORY, delete_status: 'deleted' }),
      plainFile({
        file_category: HANDOVER_CATEGORY,
        project_id: 'foreign-project',
      }),
    ]) {
      const { service, createSignedUrl } = setup({
        memberships,
        projects,
        files: [file],
      });
      await expect(
        service.downloadForClient(FILE_ID, actor('client')),
      ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
      expect(createSignedUrl).not.toHaveBeenCalled();
    }
    const missing = setup({ memberships, projects, files: [] });
    await expect(
      missing.service.downloadForClient(FILE_ID, actor('client')),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
  });

  it('validates the clientVisible flag', () => {
    expect(HandoverService.parseClientVisible({ clientVisible: true })).toBe(
      true,
    );
    for (const bad of [undefined, null, {}, { clientVisible: 'yes' }]) {
      expect(() => HandoverService.parseClientVisible(bad)).toThrow();
    }
  });
});
