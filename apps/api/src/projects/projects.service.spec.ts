import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ProjectsService } from './projects.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_A = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function queryResult(
  result: { data?: unknown; count?: number | null; error?: unknown },
  terminal: 'maybeSingle' | 'single' | 'range' | 'eq' | 'limit' = 'maybeSingle',
) {
  const query: Record<string, jest.Mock> = {};
  for (const method of [
    'select',
    'eq',
    'or',
    'in',
    'order',
    'range',
    'limit',
    'insert',
    'update',
    'delete',
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

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    project_code: 'PGS-2026-001',
    client_company_id: COMPANY_A,
    name: 'Project A',
    status: 'active',
    priority: 'medium',
    created_at: '2026-08-11T00:00:00.000Z',
    updated_at: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let client: { from: jest.Mock };

  beforeEach(() => {
    client = { from: jest.fn() };
    service = new ProjectsService({
      getSystemClient: () => client,
    } as unknown as SupabaseService);
  });

  it('creates a normalized, validated project successfully', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: COMPANY_A } }))
      .mockReturnValueOnce(queryResult({ data: null }))
      .mockReturnValueOnce(
        queryResult({ data: projectRow(), error: null }, 'single'),
      );

    const result = await service.createProject(
      {
        projectCode: 'PGS-2026-001',
        clientCompanyId: COMPANY_A,
        name: 'Project A',
        status: 'draft',
        priority: 'medium',
      },
      USER_ID,
    );

    expect(result.projectCode).toBe('PGS-2026-001');
    expect(client.from).toHaveBeenNthCalledWith(1, 'client_companies');
    expect(client.from).toHaveBeenNthCalledWith(3, 'projects');
  });

  it('returns CLIENT_NOT_FOUND when the client company is missing', async () => {
    client.from.mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.createProject(
        {
          projectCode: 'PGS-1',
          clientCompanyId: COMPANY_A,
          name: 'Project',
          status: 'draft',
          priority: 'medium',
        },
        USER_ID,
      ),
    ).rejects.toMatchObject({ response: { code: 'CLIENT_NOT_FOUND' } });
  });

  it('returns a conflict for a duplicate project code', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: { id: COMPANY_A } }))
      .mockReturnValueOnce(queryResult({ data: { id: PROJECT_ID } }));

    await expect(
      service.createProject(
        {
          projectCode: 'PGS-1',
          clientCompanyId: COMPANY_A,
          name: 'Project',
          status: 'draft',
          priority: 'medium',
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a missing or inactive primary PM to INVALID_PROJECT_MANAGER', async () => {
    for (const profile of [
      null,
      { id: USER_ID, role: 'employee', account_status: 'pending' },
    ]) {
      client.from.mockReset();
      client.from
        .mockReturnValueOnce(queryResult({ data: { id: COMPANY_A } }))
        .mockReturnValueOnce(queryResult({ data: profile }));

      await expect(
        service.createProject(
          {
            projectCode: 'PGS-1',
            clientCompanyId: COMPANY_A,
            name: 'Project',
            status: 'draft',
            priority: 'medium',
            projectManagerUserId: USER_ID,
          },
          USER_ID,
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_PROJECT_MANAGER' },
      });
    }
  });

  it('uses DB pagination and keeps the real total on an empty page', async () => {
    const query = queryResult({ data: [], count: 38, error: null }, 'range');
    client.from.mockReturnValueOnce(query);

    const result = await service.getAdminProjects({
      q: 'PGS',
      status: 'active',
      priority: 'high',
      page: 100,
      pageSize: 20,
    });

    expect(query.or).toHaveBeenCalledWith(
      'project_code.ilike.%PGS%,name.ilike.%PGS%',
    );
    expect(query.range).toHaveBeenCalledWith(1980, 1999);
    expect(result).toMatchObject({
      items: [],
      total: 38,
      page: 100,
      pageSize: 20,
      totalPages: 2,
    });
  });

  it('allows a client_contact from the project client company', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(
        queryResult({
          data: { id: USER_ID, role: 'client', account_status: 'active' },
        }),
      )
      .mockReturnValueOnce(queryResult({ data: { id: 'membership' } }))
      .mockReturnValueOnce(
        queryResult({ data: { id: 'project-member' } }, 'single'),
      );

    await expect(
      service.createMembership(
        PROJECT_ID,
        { userId: USER_ID, projectRole: 'client_contact' },
        USER_ID,
      ),
    ).resolves.toEqual({ id: 'project-member' });
  });

  it.each([
    [
      'inactive user',
      { role: 'employee', account_status: 'pending' },
      'member',
      'USER_NOT_ACTIVE',
    ],
    [
      'client as project manager',
      { role: 'client', account_status: 'active' },
      'project_manager',
      'INVALID_PROJECT_MEMBER_ROLE',
    ],
    [
      'internal user as client contact',
      { role: 'employee', account_status: 'active' },
      'client_contact',
      'INVALID_PROJECT_MEMBER_ROLE',
    ],
  ] as const)(
    'rejects %s',
    async (_label, profile, projectRole, expectedCode) => {
      client.from
        .mockReturnValueOnce(queryResult({ data: projectRow() }))
        .mockReturnValueOnce(
          queryResult({ data: { id: USER_ID, ...profile } }),
        );

      await expect(
        service.createMembership(
          PROJECT_ID,
          { userId: USER_ID, projectRole },
          USER_ID,
        ),
      ).rejects.toMatchObject({ response: { code: expectedCode } });
    },
  );

  it('returns 404 when the membership user does not exist', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.createMembership(
        PROJECT_ID,
        { userId: USER_ID, projectRole: 'member' },
        USER_ID,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_NOT_FOUND' },
    });
  });

  it('rejects a client_contact from a different company', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(
        queryResult({
          data: { id: USER_ID, role: 'client', account_status: 'active' },
        }),
      )
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.createMembership(
        PROJECT_ID,
        { userId: USER_ID, projectRole: 'client_contact' },
        USER_ID,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CLIENT_CONTACT_COMPANY_MISMATCH' },
    });
  });

  it('maps duplicate memberships to a safe 409', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(
        queryResult({
          data: { id: USER_ID, role: 'employee', account_status: 'active' },
        }),
      )
      .mockReturnValueOnce(
        queryResult(
          { data: null, error: { code: '23505', message: 'duplicate' } },
          'single',
        ),
      );

    await expect(
      service.createMembership(
        PROJECT_ID,
        { userId: USER_ID, projectRole: 'member' },
        USER_ID,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_ALREADY_EXISTS' },
    });
  });

  it('returns 404 when removing a missing membership', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.deleteMembership(PROJECT_ID, USER_ID),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_MEMBER_NOT_FOUND' } });
  });

  it('rejects removing a member who still has assigned tasks', async () => {
    const membershipId = '66666666-6666-4666-8666-666666666666';
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(
        queryResult({ data: { id: membershipId, user_id: USER_ID } }),
      )
      .mockReturnValueOnce(
        queryResult({ data: [{ id: 'assigned-task' }], error: null }, 'limit'),
      );

    await expect(
      service.deleteMembership(PROJECT_ID, membershipId),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_MEMBER_HAS_ASSIGNED_TASKS' },
    });
  });

  it('rejects an invalid project service date range before DB insert', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: { id: 'service-id' } }));

    await expect(
      service.createProjectService(
        PROJECT_ID,
        {
          serviceId: 'service-id',
          status: 'planned',
          startedAt: '2026-08-12T00:00:00.000Z',
          endedAt: '2026-08-11T00:00:00.000Z',
        },
        USER_ID,
      ),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_PROJECT_SERVICE_DATE_RANGE' },
    });
  });

  it('assigns a catalog service and maps duplicate assignments to 409', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: { id: 'service-id' } }))
      .mockReturnValueOnce(
        queryResult({ data: { id: 'assignment-id' } }, 'single'),
      );

    await expect(
      service.createProjectService(
        PROJECT_ID,
        {
          serviceId: 'service-id',
          status: 'planned',
        },
        USER_ID,
      ),
    ).resolves.toEqual({ id: 'assignment-id' });

    client.from.mockReset();
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: { id: 'service-id' } }))
      .mockReturnValueOnce(
        queryResult(
          { data: null, error: { code: '23505', message: 'duplicate' } },
          'single',
        ),
      );

    await expect(
      service.createProjectService(
        PROJECT_ID,
        { serviceId: 'service-id', status: 'planned' },
        USER_ID,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PROJECT_SERVICE_ALREADY_EXISTS' },
    });
  });

  it('returns SERVICE_NOT_FOUND before assigning an unknown service', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.createProjectService(
        PROJECT_ID,
        { serviceId: 'missing', status: 'planned' },
        USER_ID,
      ),
    ).rejects.toMatchObject({ response: { code: 'SERVICE_NOT_FOUND' } });
  });

  it('denies internal project detail to a non-member', async () => {
    client.from.mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.getInternalProjectById(USER_ID, PROJECT_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows Client A to read Project A from Company A', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: { id: 'client-member' } }));

    await expect(
      service.getClientProjectById(USER_ID, PROJECT_ID),
    ).resolves.toMatchObject({ id: PROJECT_ID, clientCompanyId: COMPANY_A });
  });

  it('hides Project B from Client A with a safe 404', async () => {
    client.from
      .mockReturnValueOnce(queryResult({ data: projectRow() }))
      .mockReturnValueOnce(queryResult({ data: null }));

    await expect(
      service.getClientProjectById(USER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_NOT_FOUND' } });
  });
});
