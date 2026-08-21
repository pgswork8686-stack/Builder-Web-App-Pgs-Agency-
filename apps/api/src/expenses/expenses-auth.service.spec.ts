/**
 * REAL-SERVICE AUTHORIZATION TESTS: ExpensesService
 */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_A_ID = '33333333-3333-4333-8333-333333333333';
const USER_B_ID = '44444444-4444-4444-8444-444444444444';
const EXPENSE_A = 'exp11111-1111-4111-8111-111111111111';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_A_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Employee A',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any; count?: number }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({
      data: response.data ?? [],
      error: response.error,
      count: response.count ?? 0,
    }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('ExpensesService — Real Authorization Logic', () => {
  let service: ExpensesService;
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
        ExpensesService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('Client Role Denials', () => {
    it('throws ForbiddenException when client tries to list expenses', async () => {
      const clientUser = makeUser({ role: 'client' });
      await expect(
        service.listExpenses({ page: 1, pageSize: 20 }, clientUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when client tries to create expense', async () => {
      const clientUser = makeUser({ role: 'client' });
      await expect(
        service.createExpense(
          {
            projectId: PROJECT_A,
            title: 'Client Lunch',
            amount: 500000,
            currencyCode: 'VND',
            expenseCategory: 'meal_entertainment',
          },
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Expense Ownership and Approval Scoping', () => {
    it('throws ForbiddenException when employee reads another employee expense', async () => {
      const employeeUser = makeUser({ role: 'employee', profileId: USER_A_ID });

      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: EXPENSE_A,
            submitted_by_user_id: USER_B_ID, // Different user
            title: 'Server Hosting',
            status: 'pending',
          },
          error: null,
        }),
      );

      await expect(
        service.getExpenseById(EXPENSE_A, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when employee attempts to review/approve expense', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      await expect(
        service.reviewExpense(EXPENSE_A, { action: 'approved' }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows accountant to review and approve pending expense', async () => {
      const accountantUser = makeUser({ role: 'accountant' });

      const expenseRow = {
        id: EXPENSE_A,
        submitted_by_user_id: USER_A_ID,
        title: 'Server Hosting',
        status: 'pending',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: expenseRow, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { ...expenseRow, status: 'approved' },
          error: null,
        }),
      );

      const result = await service.reviewExpense(
        EXPENSE_A,
        { action: 'approved' },
        accountantUser,
      );

      expect(result.status).toBe('approved');
    });
  });

  describe('Project Membership Scoping', () => {
    it('blocks an employee from creating an expense for a project they do not belong to', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(mockQueryChain({ data: null, error: null }));

      await expect(
        service.createExpense(
          {
            projectId: PROJECT_A,
            title: 'Unscoped expense',
            amount: 100000,
            currencyCode: 'VND',
            expenseCategory: 'general',
          },
          employeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(fromMock.mock.calls.map(([table]) => table)).toEqual([
        'projects',
        'project_memberships',
      ]);
    });

    it('allows an employee to create an expense for a project they belong to', async () => {
      const employeeUser = makeUser({ role: 'employee' });
      const createdExpense = {
        id: EXPENSE_A,
        project_id: PROJECT_A,
        submitted_by_user_id: employeeUser.profileId,
        status: 'pending',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: 'membership-1', project_role: 'member' },
          error: null,
        }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: createdExpense, error: null }),
      );

      const result = await service.createExpense(
        {
          projectId: PROJECT_A,
          title: 'Member scoped expense',
          amount: 100000,
          currencyCode: 'VND',
          expenseCategory: 'general',
        },
        employeeUser,
      );

      expect(result.id).toBe(EXPENSE_A);
    });

    it('limits a team leader list to projects where they are project_manager', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });
      const membershipQuery = mockQueryChain({
        data: [{ project_id: PROJECT_A }],
        error: null,
      });
      const expensesQuery = mockQueryChain({ data: [], error: null, count: 0 });

      fromMock
        .mockReturnValueOnce(membershipQuery)
        .mockReturnValueOnce(expensesQuery);

      await service.listExpenses({ page: 1, pageSize: 20 }, leaderUser);

      expect(fromMock.mock.calls.map(([table]) => table)).toEqual([
        'project_memberships',
        'project_expenses',
      ]);
      expect(membershipQuery.eq).toHaveBeenCalledWith(
        'project_role',
        'project_manager',
      );
      expect(expensesQuery.in).toHaveBeenCalledWith('project_id', [PROJECT_A]);
    });

    it('returns an empty list before querying expenses when a team leader manages no projects', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });
      fromMock.mockReturnValueOnce(mockQueryChain({ data: [], error: null }));

      await expect(
        service.listExpenses({ page: 2, pageSize: 10 }, leaderUser),
      ).resolves.toEqual({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
        totalPages: 0,
      });
      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(fromMock).toHaveBeenCalledWith('project_memberships');
    });

    it('blocks a team leader from reading an expense outside their managed projects', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: {
            id: EXPENSE_A,
            project_id: PROJECT_A,
            submitted_by_user_id: USER_B_ID,
            status: 'pending',
          },
          error: null,
        }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: 'membership-1', project_role: 'member' },
          error: null,
        }),
      );

      await expect(
        service.getExpenseById(EXPENSE_A, leaderUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a team leader to read an expense for a project they manage', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });
      const expense = {
        id: EXPENSE_A,
        project_id: PROJECT_A,
        submitted_by_user_id: USER_B_ID,
        status: 'pending',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: expense, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: 'membership-1', project_role: 'project_manager' },
          error: null,
        }),
      );

      await expect(service.getExpenseById(EXPENSE_A, leaderUser)).resolves.toBe(
        expense,
      );
    });

    it('blocks a team leader from creating an expense for a project they do not manage', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: 'membership-1', project_role: 'member' },
          error: null,
        }),
      );

      await expect(
        service.createExpense(
          {
            projectId: PROJECT_A,
            title: 'Leader unscoped expense',
            amount: 100000,
            currencyCode: 'VND',
            expenseCategory: 'general',
          },
          leaderUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a team leader to create an expense for a project they manage', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });
      const createdExpense = {
        id: EXPENSE_A,
        project_id: PROJECT_A,
        submitted_by_user_id: leaderUser.profileId,
        status: 'pending',
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: { id: PROJECT_A }, error: null }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: { id: 'membership-1', project_role: 'project_manager' },
          error: null,
        }),
      );
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: createdExpense, error: null }),
      );

      const result = await service.createExpense(
        {
          projectId: PROJECT_A,
          title: 'Managed project expense',
          amount: 100000,
          currencyCode: 'VND',
          expenseCategory: 'general',
        },
        leaderUser,
      );

      expect(result.id).toBe(EXPENSE_A);
    });
  });
});
