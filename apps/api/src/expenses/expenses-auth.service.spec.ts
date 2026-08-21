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
});
