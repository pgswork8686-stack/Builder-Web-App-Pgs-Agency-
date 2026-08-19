/**
 * REAL-SERVICE AUTHORIZATION TESTS: ProjectsService
 *
 * Strategy: Mock ONLY the Supabase transport layer (database responses).
 * ProjectsService itself is instantiated directly — no method mocking.
 * Each test drives real authorization logic through mock DB data.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { SupabaseService } from '../supabase/supabase.service';

const EMPLOYEE_A = '33333333-3333-4333-8333-333333333333';
const CLIENT_A = '66666666-6666-4666-8666-666666666666';

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // Employee A is member
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // Employee A is NOT member
const PROJECT_CLIENT_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; // belongs to Client A's company
const PROJECT_CLIENT_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'; // belongs to Client B's company

const COMPANY_A = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const COMPANY_B = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

/**
 * Build a mock Supabase query builder that supports chaining (.select, .eq, .maybeSingle, .order, etc.)
 * and returns the given response on terminal calls.
 */
function mockQueryChain(response: { data: any; error: any; count?: number }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
  // Make range resolve with count for pagination queries
  chain.range = jest
    .fn()
    .mockResolvedValue({ ...response, count: response.count ?? 0 });
  // Enable direct await on query builder chain
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject);
  return chain;
}

describe('ProjectsService — Real Authorization Logic (Supabase Transport Mocked)', () => {
  let service: ProjectsService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  // =========================================================================
  // getInternalProjectById — Employee IDOR tests
  // =========================================================================
  describe('getInternalProjectById', () => {
    it('throws ForbiddenException when employee has NO membership in foreign project', async () => {
      // First DB call: project_memberships → returns null (no matching row)
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        service.getInternalProjectById(EMPLOYEE_A, PROJECT_B),
      ).rejects.toThrow(ForbiddenException);

      const call = fromMock.mock.calls[0];
      expect(call[0]).toBe('project_memberships');

      // Verify the service does NOT proceed to query the projects table
      expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException with code PROJECT_ACCESS_DENIED for foreign project', async () => {
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await service.getInternalProjectById(EMPLOYEE_A, PROJECT_B);
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('PROJECT_ACCESS_DENIED');
    });

    it('returns project data when employee IS a member', async () => {
      const membershipRow = { id: 'm-1', project_role: 'developer' };
      const projectRow = {
        id: PROJECT_A,
        name: 'Test Project',
        project_code: 'TST-01',
        status: 'active',
        priority: 'medium',
        client_company_id: COMPANY_A,
        client_company: { id: COMPANY_A, code: 'KH_01', name: 'Client A' },
        project_manager: null,
        project_manager_user_id: null,
        start_date: null,
        due_date: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: null,
        project_memberships: [membershipRow],
        project_services: [],
      };

      // First call: project_memberships → membership found
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: membershipRow, error: null }),
      );
      // Second call: projects → project found
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: projectRow, error: null }),
      );

      const result = await service.getInternalProjectById(
        EMPLOYEE_A,
        PROJECT_A,
      );
      expect(result.id).toBe(PROJECT_A);
      expect(result.currentProjectRole).toBe('developer');
    });

    it('allows Admin to access any internal project without membership', async () => {
      const projectRow = {
        id: PROJECT_B,
        client_company_id: COMPANY_A,
        name: 'Project B',
        project_code: 'DA_02',
        status: 'active',
        priority: 'high',
        client_company: { id: COMPANY_A, code: 'KH_01', name: 'Client A' },
        project_manager: null,
        project_manager_user_id: null,
        start_date: null,
        due_date: null,
        completed_at: null,
        created_at: '2026-08-11T00:00:00.000Z',
        updated_at: '2026-08-11T00:00:00.000Z',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: projectRow, error: null }),
      );

      const result = await service.getInternalProjectById(
        'admin-user-id',
        PROJECT_B,
        'admin',
      );
      expect(result.id).toBe(PROJECT_B);
      expect(result.currentProjectRole).toBe('project_manager');
      expect(fromMock).toHaveBeenCalledWith('projects');
    });

    it('throws NotFoundException when project does not exist even with membership', async () => {
      const membershipRow = { id: 'm-1', project_role: 'developer' };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: membershipRow, error: null }),
      );
      // Project not found
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        service.getInternalProjectById(EMPLOYEE_A, PROJECT_A),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getClientProjectById — Client IDOR tests
  // =========================================================================
  describe('getClientProjectById', () => {
    it('throws NotFoundException when client tries to access foreign company project (IDOR)', async () => {
      // Project belongs to COMPANY_B
      const projectRow = {
        id: PROJECT_CLIENT_B,
        client_company_id: COMPANY_B,
        name: 'Company B Project',
        project_code: 'CB-01',
        status: 'active',
        priority: 'low',
        client_company: { id: COMPANY_B, code: 'KH_B2', name: 'Client B' },
        project_manager: null,
        project_manager_user_id: null,
        start_date: null,
        due_date: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: null,
        project_services: [],
      };

      // First call: projects → found (project exists)
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: projectRow, error: null }),
      );
      // Second call: client_memberships → Client A NOT in COMPANY_B
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await service.getClientProjectById(CLIENT_A, PROJECT_CLIENT_B);
      } catch (e) {
        caughtError = e;
      }
      expect(caughtError).toBeInstanceOf(NotFoundException);
      expect(caughtError.response?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns project when client IS a member of the project company', async () => {
      const projectRow = {
        id: PROJECT_CLIENT_A,
        client_company_id: COMPANY_A,
        name: 'Company A Project',
        project_code: 'CA-01',
        status: 'active',
        priority: 'high',
        client_company: { id: COMPANY_A, code: 'KH_A1', name: 'Client A' },
        project_manager: null,
        project_manager_user_id: null,
        start_date: null,
        due_date: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: null,
        project_services: [],
      };
      const membershipRow = { id: 'cm-1' };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: projectRow, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: membershipRow, error: null }),
      );

      const result = await service.getClientProjectById(
        CLIENT_A,
        PROJECT_CLIENT_A,
      );
      expect(result.id).toBe(PROJECT_CLIENT_A);
    });

    it('throws NotFoundException when project does not exist at all', async () => {
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        service.getClientProjectById(CLIENT_A, 'non-existent-project-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getProjectServiceItems — Multi-role and Foreign Scope tests
  // =========================================================================
  describe('getProjectServiceItems Authorization', () => {
    const projectRow = {
      id: PROJECT_A,
      client_company_id: COMPANY_A,
    };
    const itemsRow = [
      {
        id: 'item-1',
        project_id: PROJECT_A,
        name: 'Item 1',
        status: 'planned',
      },
    ];

    it('Admin + Project A → PASS', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(
          mockQueryChain({ data: itemsRow, error: null, count: 1 }),
        ); // items query

      const res = await service.getProjectServiceItems(
        'admin-user',
        'admin',
        PROJECT_A,
      );
      expect(res).toEqual(itemsRow);
    });

    it('Employee member of Project A → PASS', async () => {
      fromMock
        .mockReturnValueOnce(
          mockQueryChain({
            data: { id: 'pm-1', project_role: 'member' },
            error: null,
          }),
        ) // membership check
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(
          mockQueryChain({ data: itemsRow, error: null, count: 1 }),
        ); // items query

      const res = await service.getProjectServiceItems(
        EMPLOYEE_A,
        'employee',
        PROJECT_A,
      );
      expect(res).toEqual(itemsRow);
    });

    it('Employee NOT member of Project A → FAIL with PROJECT_ACCESS_DENIED', async () => {
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null })); // membership check returns null

      await expect(
        service.getProjectServiceItems(EMPLOYEE_A, 'employee', PROJECT_A),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_ACCESS_DENIED' },
      });
    });

    it('Team Leader member of Project A → PASS', async () => {
      fromMock
        .mockReturnValueOnce(
          mockQueryChain({
            data: { id: 'pm-1', project_role: 'project_manager' },
            error: null,
          }),
        ) // membership check
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(
          mockQueryChain({ data: itemsRow, error: null, count: 1 }),
        ); // items query

      const res = await service.getProjectServiceItems(
        'leader-user',
        'team_leader',
        PROJECT_A,
      );
      expect(res).toEqual(itemsRow);
    });

    it('Accountant member of Project A → PASS read', async () => {
      fromMock
        .mockReturnValueOnce(
          mockQueryChain({
            data: { id: 'pm-1', project_role: 'viewer' },
            error: null,
          }),
        ) // membership check
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(
          mockQueryChain({ data: itemsRow, error: null, count: 1 }),
        ); // items query

      const res = await service.getProjectServiceItems(
        'accountant-user',
        'accountant',
        PROJECT_A,
      );
      expect(res).toEqual(itemsRow);
    });

    it('Client belonging to client company of Project A → PASS read', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(
          mockQueryChain({ data: { id: 'cm-1' }, error: null }),
        ) // client_memberships check
        .mockReturnValueOnce(
          mockQueryChain({ data: itemsRow, error: null, count: 1 }),
        ); // items query

      const res = await service.getProjectServiceItems(
        CLIENT_A,
        'client',
        PROJECT_A,
      );
      expect(res).toEqual(itemsRow);
    });

    it('Client from another company → FAIL with PROJECT_NOT_FOUND', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: null, error: null })); // client_memberships check returns null

      await expect(
        service.getProjectServiceItems(CLIENT_A, 'client', PROJECT_A),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_NOT_FOUND' },
      });
    });

    it('Foreign projectServiceId not belonging to projectId → FAIL with PROJECT_SERVICE_NOT_FOUND', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: null, error: null })); // project_services lookup returns null

      await expect(
        service.getProjectServiceItems(
          'admin-user',
          'admin',
          PROJECT_A,
          'foreign-project-service-id',
        ),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_SERVICE_NOT_FOUND' },
      });
    });
  });

  // =========================================================================
  // updateProjectServiceItem — Write Authorization and Scope tests
  // =========================================================================
  describe('updateProjectServiceItem Authorization', () => {
    const projectRow = {
      id: PROJECT_A,
      client_company_id: COMPANY_A,
    };
    const itemRow = {
      id: 'item-1',
      project_id: PROJECT_A,
      name: 'Item 1',
      status: 'planned',
    };

    it('Admin → PASS', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: itemRow, error: null })) // find item in project
        .mockReturnValueOnce(
          mockQueryChain({
            data: { ...itemRow, status: 'done' },
            error: null,
          }),
        ); // update single

      const res = await service.updateProjectServiceItem(
        'admin-user',
        'admin',
        PROJECT_A,
        'item-1',
        { status: 'done' },
      );
      expect(res.status).toBe('done');
    });

    it('Employee member of Project A → PASS', async () => {
      fromMock
        .mockReturnValueOnce(
          mockQueryChain({
            data: { id: 'pm-1', project_role: 'member' },
            error: null,
          }),
        ) // membership check
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: itemRow, error: null })) // find item in project
        .mockReturnValueOnce(
          mockQueryChain({
            data: { ...itemRow, status: 'in_progress' },
            error: null,
          }),
        ); // update single

      const res = await service.updateProjectServiceItem(
        EMPLOYEE_A,
        'employee',
        PROJECT_A,
        'item-1',
        { status: 'in_progress' },
      );
      expect(res.status).toBe('in_progress');
    });

    it('Team Leader member of Project A → PASS', async () => {
      fromMock
        .mockReturnValueOnce(
          mockQueryChain({
            data: { id: 'pm-1', project_role: 'project_manager' },
            error: null,
          }),
        ) // membership check
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: itemRow, error: null })) // find item in project
        .mockReturnValueOnce(
          mockQueryChain({
            data: { ...itemRow, status: 'blocked' },
            error: null,
          }),
        ); // update single

      const res = await service.updateProjectServiceItem(
        'leader-user',
        'team_leader',
        PROJECT_A,
        'item-1',
        { status: 'blocked' },
      );
      expect(res.status).toBe('blocked');
    });

    it('Employee non-member → FAIL with PROJECT_ACCESS_DENIED', async () => {
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null })); // membership check returns null

      await expect(
        service.updateProjectServiceItem(
          EMPLOYEE_A,
          'employee',
          PROJECT_A,
          'item-1',
          { status: 'done' },
        ),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_ACCESS_DENIED' },
      });
    });

    it('Client → FAIL with PROJECT_ACCESS_DENIED (no write access)', async () => {
      await expect(
        service.updateProjectServiceItem(
          CLIENT_A,
          'client',
          PROJECT_A,
          'item-1',
          { status: 'done' },
        ),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_ACCESS_DENIED' },
      });
    });

    it('Accountant → FAIL with PROJECT_ACCESS_DENIED (no write access)', async () => {
      await expect(
        service.updateProjectServiceItem(
          'accountant-user',
          'accountant',
          PROJECT_A,
          'item-1',
          { status: 'done' },
        ),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_ACCESS_DENIED' },
      });
    });

    it('Foreign item from Project B → FAIL with PROJECT_SERVICE_ITEM_NOT_FOUND', async () => {
      fromMock
        .mockReturnValueOnce(mockQueryChain({ data: projectRow, error: null })) // getProjectRow
        .mockReturnValueOnce(mockQueryChain({ data: null, error: null })); // item lookup in PROJECT_A returns null

      await expect(
        service.updateProjectServiceItem(
          'admin-user',
          'admin',
          PROJECT_A,
          'item-from-project-b',
          { status: 'done' },
        ),
      ).rejects.toMatchObject({
        response: { code: 'PROJECT_SERVICE_ITEM_NOT_FOUND' },
      });
    });
  });
});
