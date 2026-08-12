import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import type { SupabaseService } from '../supabase/supabase.service';
import { WorkspaceAccessService } from './workspace-access.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function user(role: RequestUser['role']): RequestUser {
  return {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: null,
    phone: null,
    accountStatus: 'active',
    role,
    fullName: null,
    avatarUrl: null,
    approvedAt: null,
  };
}

function query(data: unknown, error: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq']) chain[method] = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data, error });
  return chain;
}

describe('WorkspaceAccessService', () => {
  let from: jest.Mock;
  let service: WorkspaceAccessService;

  beforeEach(() => {
    from = jest.fn();
    service = new WorkspaceAccessService({
      getSystemClient: () => ({ from }),
    } as unknown as SupabaseService);
  });

  it('allows an admin without requiring project membership', async () => {
    from.mockReturnValueOnce(query({ id: PROJECT_ID }));
    await expect(
      service.requireProjectAccess(PROJECT_ID, user('admin'), 'DENIED'),
    ).resolves.toMatchObject({ isAdmin: true, isManager: true });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('allows an internal project member and resolves manager capability', async () => {
    from
      .mockReturnValueOnce(query({ id: PROJECT_ID }))
      .mockReturnValueOnce(query({ project_role: 'project_manager' }));
    await expect(
      service.requireProjectAccess(PROJECT_ID, user('team_leader'), 'DENIED'),
    ).resolves.toMatchObject({
      isManager: true,
      projectRole: 'project_manager',
    });
  });

  it('denies non-members and clients from internal workspace data', async () => {
    from
      .mockReturnValueOnce(query({ id: PROJECT_ID }))
      .mockReturnValueOnce(query(null));
    await expect(
      service.requireProjectAccess(PROJECT_ID, user('employee'), 'DENIED'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    from.mockReset();
    await expect(
      service.requireProjectAccess(PROJECT_ID, user('client'), 'DENIED'),
    ).rejects.toMatchObject({ response: { code: 'DENIED' } });
    expect(from).not.toHaveBeenCalled();
  });

  it('denies a task ID that belongs to another project', async () => {
    from.mockReturnValueOnce(
      query({
        id: TASK_ID,
        project_id: '44444444-4444-4444-8444-444444444444',
      }),
    );
    await expect(
      service.requireTask(PROJECT_ID, TASK_ID, 'COMMENT_ACCESS_DENIED'),
    ).rejects.toMatchObject({
      response: { code: 'COMMENT_ACCESS_DENIED' },
    });
  });
});
