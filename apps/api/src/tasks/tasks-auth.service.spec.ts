/**
 * REAL-SERVICE AUTHORIZATION TESTS: TasksService
 *
 * Strategy: Mock ONLY the Supabase transport layer.
 * TasksService itself is instantiated directly — no method mocking.
 * Tests drive real authorization logic for Tasks:
 * - Foreign project access
 * - Foreign task / project-task mismatch
 * - Client role denial
 * - Assignee / Member role permission scopes (only manager can create/edit non-status, assignee can only update status)
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TASK_A = 'task1111-1111-4111-8111-111111111111';

const EMPLOYEE_A_PROFILE = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE_B_PROFILE = '44444444-4444-4444-8444-444444444444';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: EMPLOYEE_A_PROFILE,
    email: 'employee@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Employee A',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
}

describe('TasksService — Real Authorization Logic (Supabase Transport Mocked)', () => {
  let service: TasksService;
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
        TasksService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  // =========================================================================
  // 1. Client Role Restrictions
  // =========================================================================
  describe('Client Role Access Denial', () => {
    it('throws ForbiddenException(TASK_ACCESS_DENIED) immediately for client role', async () => {
      const clientUser = makeUser({ role: 'client' });

      let caughtError: any;
      try {
        await service.getTasks(
          PROJECT_A,
          { page: 1, pageSize: 20 },
          clientUser,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('TASK_ACCESS_DENIED');
      // Synchronous check before any DB query
      expect(fromMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Foreign Project Scope (Employee Not Member)
  // =========================================================================
  describe('Foreign Project Scope', () => {
    it('throws ForbiddenException(PROJECT_ACCESS_DENIED) when employee has no membership in project', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // projects query → project exists
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_B }, error: null }),
      );
      // project_memberships query → no row (not a member)
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await service.getTask(PROJECT_B, TASK_A, employeeUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('PROJECT_ACCESS_DENIED');
    });

    it('throws NotFoundException when project does not exist at all', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // projects query → not found
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        service.getTask('non-existent-proj', TASK_A, employeeUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // 3. Project-Task Mismatch / Foreign Task (IDOR)
  // =========================================================================
  describe('Project-Task IDOR / Mismatch', () => {
    it('throws NotFoundException(TASK_NOT_FOUND) when task does not belong to the requested project', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      // projects → exists
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      // project_memberships → employee is member
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // tasks query with eq('project_id', PROJECT_A).eq('id', TASK_A) → returns null (task belongs to different project)
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      let caughtError: any;
      try {
        await service.getTask(PROJECT_A, TASK_A, employeeUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(NotFoundException);
      expect(caughtError.response?.code).toBe('TASK_NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. Role & Mutation Permissions (Create Task: Only Manager/Admin)
  // =========================================================================
  describe('Task Creation Permissions', () => {
    it('throws ForbiddenException(TASK_ACCESS_DENIED) when regular member (developer) tries to create task', async () => {
      const developerUser = makeUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      // project_role is 'developer', not 'project_manager'
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );

      let caughtError: any;
      try {
        await service.createTask(
          PROJECT_A,
          {
            title: 'Unauthorized Task',
            status: 'todo',
            priority: 'medium',
            sortOrder: 0,
          },
          developerUser,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('TASK_ACCESS_DENIED');
    });

    it('allows project manager to create task', async () => {
      const managerUser = makeUser({ role: 'team_leader' });
      const createdTask = {
        id: 'new-task-1',
        project_id: PROJECT_A,
        title: 'Manager Created Task',
        status: 'todo',
        priority: 'high',
        assignee_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { project_role: 'project_manager' },
          error: null,
        }),
      );
      // tasks insert → returns createdTask
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: createdTask, error: null }),
      );

      const result = await service.createTask(
        PROJECT_A,
        {
          title: 'Manager Created Task',
          status: 'todo',
          priority: 'high',
          sortOrder: 0,
        },
        managerUser,
      );

      expect(result.id).toBe('new-task-1');
    });
  });

  // =========================================================================
  // 5. Update Task Scoping (Assignee only update status; Non-assignee developer blocked)
  // =========================================================================
  describe('Task Update Scoping', () => {
    it('throws ForbiddenException when developer edits task they are NOT assigned to', async () => {
      const developerUser = makeUser({
        role: 'employee',
        profileId: EMPLOYEE_A_PROFILE,
      });
      const taskRow = {
        id: TASK_A,
        project_id: PROJECT_A,
        assignee_user_id: EMPLOYEE_B_PROFILE, // assigned to Employee B!
        title: 'Task A',
        status: 'todo',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      // tasks lookup
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: taskRow, error: null }),
      );

      let caughtError: any;
      try {
        await service.updateTask(
          PROJECT_A,
          TASK_A,
          { status: 'in_progress' },
          developerUser,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('TASK_ACCESS_DENIED');
    });

    it('throws ForbiddenException when assignee tries to edit non-status fields (e.g. title)', async () => {
      const assigneeUser = makeUser({
        role: 'employee',
        profileId: EMPLOYEE_A_PROFILE,
      });
      const taskRow = {
        id: TASK_A,
        project_id: PROJECT_A,
        assignee_user_id: EMPLOYEE_A_PROFILE, // assigned to Employee A
        title: 'Task A',
        status: 'todo',
        start_date: null,
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { project_role: 'developer' }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: taskRow, error: null }),
      );

      // Assignee attempts to edit title (not allowed, only status allowed)
      let caughtError: any;
      try {
        await service.updateTask(
          PROJECT_A,
          TASK_A,
          { title: 'Hacked Title' },
          assigneeUser,
        );
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('TASK_ACCESS_DENIED');
    });
  });
});
