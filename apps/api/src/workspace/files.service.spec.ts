import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import { FilesService } from './files.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import type { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '66666666-6666-4666-8666-666666666666';
const FILE_ID = '77777777-7777-4777-8777-777777777777';
const STORAGE_PATH = `projects/${PROJECT_ID}/2026/08/file.pdf`;

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

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    project_id: PROJECT_ID,
    task_id: null,
    user_id: USER_ID,
    storage_path: STORAGE_PATH,
    expected_name: 'file.pdf',
    expected_mime: 'application/pdf',
    expected_size: 100,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    project_id: PROJECT_ID,
    task_id: null,
    uploaded_by: USER_ID,
    storage_path: STORAGE_PATH,
    original_name: 'file.pdf',
    mime_type: 'application/pdf',
    size_bytes: 100,
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T10:00:00.000Z',
    ...overrides,
  };
}

function queryResult(
  result: Record<string, unknown>,
  terminal: 'single' | 'maybeSingle' | 'range' | 'then',
) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'eq', 'ilike', 'order', 'insert', 'delete']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.single = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => chain);
  chain.range = jest.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  if (terminal !== 'then')
    chain[terminal] = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('FilesService', () => {
  let from: jest.Mock;
  let rpc: jest.Mock;
  let storageApi: {
    createSignedUploadUrl: jest.Mock;
    list: jest.Mock;
    createSignedUrl: jest.Mock;
    remove: jest.Mock;
  };
  let access: {
    requireProjectAccess: jest.Mock;
    requireTask: jest.Mock;
  };
  let realtime: { emitProjectEvent: jest.Mock };
  let service: FilesService;

  beforeEach(() => {
    from = jest.fn();
    rpc = jest.fn();
    storageApi = {
      createSignedUploadUrl: jest.fn(),
      list: jest.fn(),
      createSignedUrl: jest.fn(),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
    access = {
      requireProjectAccess: jest.fn().mockResolvedValue({
        isAdmin: false,
        isManager: false,
        projectRole: 'member',
      }),
      requireTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
    };
    realtime = { emitProjectEvent: jest.fn() };
    service = new FilesService(
      {
        getSystemClient: () => ({
          from,
          rpc,
          storage: { from: () => storageApi },
        }),
      } as unknown as SupabaseService,
      access as unknown as WorkspaceAccessService,
      realtime as unknown as WorkspaceRealtimeGateway,
    );
  });

  it('rejects disallowed MIME/extension pairs and oversized files', async () => {
    await expect(
      service.createUploadRequest(
        PROJECT_ID,
        { fileName: 'payload.js', mimeType: 'text/javascript', sizeBytes: 100 },
        user(),
      ),
    ).rejects.toMatchObject({ response: { code: 'FILE_TYPE_NOT_ALLOWED' } });

    await expect(
      service.createUploadRequest(
        PROJECT_ID,
        {
          fileName: 'large.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 25 * 1024 * 1024 + 1,
        },
        user(),
      ),
    ).rejects.toMatchObject({ response: { code: 'FILE_TOO_LARGE' } });
  });

  it('creates a server-bound upload session and signed upload URL', async () => {
    from.mockReturnValueOnce(
      queryResult({ data: { id: SESSION_ID }, error: null }, 'single'),
    );
    storageApi.createSignedUploadUrl.mockResolvedValueOnce({
      data: {
        signedUrl: 'https://storage.example/upload?token=signed',
        token: 'signed',
      },
      error: null,
    });
    const result = await service.createUploadRequest(
      PROJECT_ID,
      {
        fileName: '../proposal.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      },
      user(),
    );
    expect(result).toMatchObject({
      uploadSessionId: SESSION_ID,
      bucket: 'project-files',
    });
    expect(result.path).not.toContain('..');
  });

  it('denies viewers, clients/non-members and cross-project task uploads', async () => {
    access.requireProjectAccess.mockResolvedValueOnce({
      isAdmin: false,
      isManager: false,
      projectRole: 'viewer',
    });
    await expect(
      service.createUploadRequest(
        PROJECT_ID,
        { fileName: 'file.pdf', mimeType: 'application/pdf', sizeBytes: 100 },
        user(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    access.requireProjectAccess.mockRejectedValueOnce(
      new ForbiddenException({ code: 'FILE_ACCESS_DENIED' }),
    );
    await expect(
      service.list(PROJECT_ID, { page: 1, pageSize: 20 }, user()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    access.requireTask.mockRejectedValueOnce(
      new ForbiddenException({ code: 'FILE_ACCESS_DENIED' }),
    );
    await expect(
      service.createUploadRequest(
        PROJECT_ID,
        { fileName: 'file.pdf', mimeType: 'application/pdf', sizeBytes: 100 },
        user(),
        TASK_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies expired upload sessions and wrong finalize scopes', async () => {
    from
      .mockReturnValueOnce(
        queryResult(
          {
            data: session({
              expires_at: new Date(Date.now() - 1000).toISOString(),
            }),
            error: null,
          },
          'maybeSingle',
        ),
      )
      .mockReturnValueOnce(queryResult({ error: null }, 'then'));
    await expect(
      service.finalize(PROJECT_ID, { uploadSessionId: SESSION_ID }, user()),
    ).rejects.toMatchObject({
      response: { code: 'FILE_UPLOAD_SESSION_EXPIRED' },
    });

    from.mockReset();
    from.mockReturnValueOnce(
      queryResult({ data: session(), error: null }, 'maybeSingle'),
    );
    await expect(
      service.finalize(
        PROJECT_ID,
        { uploadSessionId: SESSION_ID },
        user(),
        TASK_ID,
      ),
    ).rejects.toMatchObject({ response: { code: 'FILE_FINALIZE_INVALID' } });
  });

  it('verifies storage metadata before atomic finalization and emits afterward', async () => {
    from.mockReturnValueOnce(
      queryResult({ data: session(), error: null }, 'maybeSingle'),
    );
    storageApi.list.mockResolvedValueOnce({
      data: [
        {
          name: 'file.pdf',
          metadata: { size: 100, mimetype: 'application/pdf' },
        },
      ],
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: file(), error: null });
    await expect(
      service.finalize(PROJECT_ID, { uploadSessionId: SESSION_ID }, user()),
    ).resolves.toMatchObject({ id: FILE_ID });
    expect(rpc).toHaveBeenCalledWith('phase4_finalize_project_file', {
      p_session_id: SESSION_ID,
      p_user_id: USER_ID,
    });
    expect(realtime.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'file.created' }),
    );
  });

  it('returns a short-lived signed download URL for a valid file', async () => {
    from.mockReturnValueOnce(
      queryResult({ data: file(), error: null }, 'maybeSingle'),
    );
    storageApi.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://storage.example/download' },
      error: null,
    });
    await expect(
      service.download(PROJECT_ID, FILE_ID, user()),
    ).resolves.toEqual({
      signedUrl: 'https://storage.example/download',
      expiresIn: 120,
    });
  });

  it('denies an unrelated project file and another member deletion', async () => {
    from.mockReturnValueOnce(
      queryResult(
        { data: file({ project_id: OTHER_PROJECT_ID }), error: null },
        'maybeSingle',
      ),
    );
    await expect(
      service.download(PROJECT_ID, FILE_ID, user()),
    ).rejects.toMatchObject({ response: { code: 'FILE_ACCESS_DENIED' } });

    from.mockReset();
    from.mockReturnValueOnce(
      queryResult(
        { data: file({ uploaded_by: OTHER_USER_ID }), error: null },
        'maybeSingle',
      ),
    );
    await expect(
      service.remove(PROJECT_ID, FILE_ID, user()),
    ).rejects.toMatchObject({ response: { code: 'FILE_ACCESS_DENIED' } });
  });

  it('allows uploader and project manager deletion', async () => {
    from
      .mockReturnValueOnce(
        queryResult({ data: file(), error: null }, 'maybeSingle'),
      )
      .mockReturnValueOnce(queryResult({ error: null }, 'then'));
    await expect(service.remove(PROJECT_ID, FILE_ID, user())).resolves.toEqual({
      success: true,
    });

    from.mockReset();
    access.requireProjectAccess.mockResolvedValueOnce({
      isAdmin: false,
      isManager: true,
      projectRole: 'project_manager',
    });
    from
      .mockReturnValueOnce(
        queryResult(
          { data: file({ uploaded_by: OTHER_USER_ID }), error: null },
          'maybeSingle',
        ),
      )
      .mockReturnValueOnce(queryResult({ error: null }, 'then'));
    await expect(service.remove(PROJECT_ID, FILE_ID, user())).resolves.toEqual({
      success: true,
    });
  });
});
