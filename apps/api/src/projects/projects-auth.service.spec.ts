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
    single: jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
  // Make range resolve with count for pagination queries
  chain.range = jest
    .fn()
    .mockResolvedValue({ ...response, count: response.count ?? 0 });
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
});
