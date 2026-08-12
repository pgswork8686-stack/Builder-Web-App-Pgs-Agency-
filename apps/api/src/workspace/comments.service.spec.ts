import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import { CommentsService } from './comments.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import type { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';

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

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    task_id: TASK_ID,
    author_user_id: USER_ID,
    content: 'Nội dung',
    edited_at: null,
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T10:00:00.000Z',
    ...overrides,
  };
}

function queryResult(
  result: Record<string, unknown>,
  terminal: 'range' | 'single' | 'maybeSingle' | 'then',
) {
  const chain: Record<string, any> = {};
  for (const method of [
    'select',
    'eq',
    'order',
    'insert',
    'update',
    'delete',
  ]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.range = jest.fn(() => chain);
  chain.single = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  if (terminal !== 'then')
    chain[terminal] = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('CommentsService', () => {
  let from: jest.Mock;
  let access: {
    requireProjectAccess: jest.Mock;
    requireTask: jest.Mock;
  };
  let realtime: { emitProjectEvent: jest.Mock };
  let service: CommentsService;

  beforeEach(() => {
    from = jest.fn();
    access = {
      requireProjectAccess: jest.fn().mockResolvedValue({
        isAdmin: false,
        isManager: false,
        projectRole: 'member',
      }),
      requireTask: jest.fn().mockResolvedValue({ id: TASK_ID }),
    };
    realtime = { emitProjectEvent: jest.fn() };
    service = new CommentsService(
      { getSystemClient: () => ({ from }) } as unknown as SupabaseService,
      access as unknown as WorkspaceAccessService,
      realtime as unknown as WorkspaceRealtimeGateway,
    );
  });

  it('lists project task comments with DB pagination', async () => {
    const list = queryResult(
      { data: [comment()], count: 1, error: null },
      'range',
    );
    from.mockReturnValueOnce(list);
    const result = await service.list(
      PROJECT_ID,
      TASK_ID,
      { page: 2, pageSize: 20 },
      user(),
    );
    expect(list.range).toHaveBeenCalledWith(20, 39);
    expect(result).toMatchObject({ total: 1, page: 2 });
    expect(result.items[0]).toMatchObject({ canEdit: true, canDelete: true });
  });

  it('denies clients and non-members before querying comments', async () => {
    access.requireProjectAccess.mockRejectedValueOnce(
      new ForbiddenException({ code: 'COMMENT_ACCESS_DENIED' }),
    );
    await expect(
      service.list(PROJECT_ID, TASK_ID, { page: 1, pageSize: 20 }, user()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(from).not.toHaveBeenCalled();
  });

  it('allows a member to create a comment and emits after the insert', async () => {
    from.mockReturnValueOnce(
      queryResult({ data: comment(), error: null }, 'single'),
    );
    await expect(
      service.create(PROJECT_ID, TASK_ID, { content: 'Nội dung' }, user()),
    ).resolves.toMatchObject({ id: COMMENT_ID });
    expect(realtime.emitProjectEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'comment.created' }),
    );
  });

  it('keeps internal viewers read-only', async () => {
    access.requireProjectAccess.mockResolvedValue({
      isAdmin: false,
      isManager: false,
      projectRole: 'viewer',
    });

    const list = queryResult(
      { data: [comment()], count: 1, error: null },
      'range',
    );
    from.mockReturnValueOnce(list);
    await expect(
      service.list(PROJECT_ID, TASK_ID, { page: 1, pageSize: 20 }, user()),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ canEdit: false, canDelete: false })],
    });

    await expect(
      service.create(
        PROJECT_ID,
        TASK_ID,
        { content: 'Không được phép' },
        user(),
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMMENT_ACCESS_DENIED' },
    });

    await expect(
      service.update(
        PROJECT_ID,
        TASK_ID,
        COMMENT_ID,
        { content: 'Không được phép' },
        user(),
      ),
    ).rejects.toMatchObject({ response: { code: 'COMMENT_EDIT_DENIED' } });

    await expect(
      service.remove(PROJECT_ID, TASK_ID, COMMENT_ID, user()),
    ).rejects.toMatchObject({ response: { code: 'COMMENT_DELETE_DENIED' } });

    expect(from).toHaveBeenCalledTimes(1);
  });

  it('allows editing own comment and denies editing another member comment', async () => {
    from
      .mockReturnValueOnce(
        queryResult({ data: comment(), error: null }, 'maybeSingle'),
      )
      .mockReturnValueOnce(
        queryResult(
          { data: comment({ content: 'Đã sửa' }), error: null },
          'single',
        ),
      );
    await expect(
      service.update(
        PROJECT_ID,
        TASK_ID,
        COMMENT_ID,
        { content: 'Đã sửa' },
        user(),
      ),
    ).resolves.toMatchObject({ content: 'Đã sửa' });

    from.mockReset();
    from.mockReturnValueOnce(
      queryResult(
        { data: comment({ author_user_id: OTHER_USER_ID }), error: null },
        'maybeSingle',
      ),
    );
    await expect(
      service.update(
        PROJECT_ID,
        TASK_ID,
        COMMENT_ID,
        { content: 'Không được phép' },
        user(),
      ),
    ).rejects.toMatchObject({ response: { code: 'COMMENT_EDIT_DENIED' } });
  });

  it('allows project manager moderation delete', async () => {
    access.requireProjectAccess.mockResolvedValueOnce({
      isAdmin: false,
      isManager: true,
      projectRole: 'project_manager',
    });
    from
      .mockReturnValueOnce(
        queryResult(
          { data: comment({ author_user_id: OTHER_USER_ID }), error: null },
          'maybeSingle',
        ),
      )
      .mockReturnValueOnce(queryResult({ error: null }, 'then'));
    await expect(
      service.remove(PROJECT_ID, TASK_ID, COMMENT_ID, user()),
    ).resolves.toEqual({ success: true });
  });

  it('returns not found and denies cross-task comment confusion', async () => {
    from.mockReturnValueOnce(
      queryResult({ data: null, error: null }, 'maybeSingle'),
    );
    await expect(
      service.remove(PROJECT_ID, TASK_ID, COMMENT_ID, user()),
    ).rejects.toBeInstanceOf(NotFoundException);

    from.mockReset();
    from.mockReturnValueOnce(
      queryResult(
        {
          data: comment({
            task_id: '66666666-6666-4666-8666-666666666666',
          }),
          error: null,
        },
        'maybeSingle',
      ),
    );
    await expect(
      service.remove(PROJECT_ID, TASK_ID, COMMENT_ID, user()),
    ).rejects.toMatchObject({ response: { code: 'COMMENT_ACCESS_DENIED' } });
  });
});
