/**
 * REAL-SERVICE AUTHORIZATION TESTS: PayrollService
 */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const USER_ID = '33333333-3333-4333-8333-333333333333';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Test User',
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
    ilike: jest.fn().mockReturnThis(),
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

describe('PayrollService — Real Authorization Logic', () => {
  let service: PayrollService;
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
        PayrollService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  describe('Payroll Run Management Role Restrictions', () => {
    it('throws ForbiddenException when employee tries to list payroll runs', async () => {
      const employeeUser = makeUser({ role: 'employee' });
      await expect(
        service.listPayrollRuns({ page: 1, pageSize: 20 }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when team_leader tries to generate payroll run', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });
      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Luong Thang 8',
            standardWorkingDays: 22,
          },
          leaderUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows accountant to list payroll runs', async () => {
      const accountantUser = makeUser({ role: 'accountant' });
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: [{ id: 'run-1', title: 'Luong Thang 8' }],
          error: null,
          count: 1,
        }),
      );

      const result = await service.listPayrollRuns(
        { page: 1, pageSize: 20 },
        accountantUser,
      );
      expect(result.items.length).toBe(1);
    });
  });

  describe('Employee Personal Payslips', () => {
    it('allows employee to view their own payslips', async () => {
      const employeeUser = makeUser({ role: 'employee', profileId: USER_ID });
      const payslips = [
        {
          id: 'ps-1',
          user_id: USER_ID,
          gross_salary: 15000000,
          net_salary: 13500000,
        },
      ];

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: payslips, error: null }),
      );

      const result = await service.getMyPayslips(employeeUser);
      expect(result.length).toBe(1);
      expect(result[0].net_salary).toBe(13500000);
    });
  });
});
