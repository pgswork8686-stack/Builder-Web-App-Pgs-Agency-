/**
 * REAL-SERVICE AUTHORIZATION & INTEGRITY TESTS: PayrollService
 */
import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';
import { CreateCompensationRevisionSchema } from './dto/payroll.dto';

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
    upsert: jest.fn().mockReturnThis(),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('PayrollService — Authorization & Integrity Suite', () => {
  let service: PayrollService;
  let fromMock: jest.Mock;
  let rpcMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    rpcMock = jest.fn();

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
        rpc: rpcMock,
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

  describe('1. Role Access & Mutation Restrictions', () => {
    it('throws ForbiddenException when employee tries to list payroll runs', async () => {
      const employeeUser = makeUser({ role: 'employee' });
      await expect(
        service.listPayrollRuns({ page: 1, pageSize: 20 }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when client tries to access payroll', async () => {
      const clientUser = makeUser({ role: 'client' });
      await expect(
        service.listPayrollRuns({ page: 1, pageSize: 20 }, clientUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Test Payroll',
          },
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Admin and Accountant to query compensations', async () => {
      const activeEmployees = mockQueryChain({
        data: [
          {
            user_id: USER_ID,
            employee_code: 'NV01',
            job_title: 'Developer',
            employment_status: 'active',
            profile: {
              id: USER_ID,
              full_name: 'Test',
              email: 'test@pgs.vn',
              account_code: 'ACC01',
            },
          },
        ],
        error: null,
      });
      const compHistory = mockQueryChain({
        data: [
          {
            id: 'h1',
            user_id: USER_ID,
            base_salary: '25000000.00',
            allowances: '2000000.00',
            effective_from: '2026-01-01',
            payroll_eligible: true,
            notes: 'Initial',
          },
        ],
        error: null,
      });
      fromMock
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(compHistory);

      const result = await service.listEmployeeCompensations(
        makeUser({ role: 'accountant' }),
      );
      expect(result.items.length).toBe(1);
      expect(result.items[0].baseSalary).toBe(25000000);
      expect(result.items[0].status).toBe('configured');
    });
  });

  describe('2. DTO & Compensation Validation', () => {
    it('validates CreateCompensationRevisionSchema: rejects non-first-day effective_from', () => {
      const res = CreateCompensationRevisionSchema.safeParse({
        baseSalary: 15_000_000,
        allowances: 1_000_000,
        effectiveFrom: '2026-08-15',
        payrollEligible: true,
      });
      expect(res.success).toBe(false);
    });

    it('validates CreateCompensationRevisionSchema: accepts YYYY-MM-01 format', () => {
      const res = CreateCompensationRevisionSchema.safeParse({
        baseSalary: 15_000_000,
        allowances: 1_000_000,
        effectiveFrom: '2026-08-01',
        payrollEligible: true,
      });
      expect(res.success).toBe(true);
    });

    it('rejects negative allowances or zero base salary in schema', () => {
      const res1 = CreateCompensationRevisionSchema.safeParse({
        baseSalary: 0,
        allowances: 0,
        effectiveFrom: '2026-08-01',
      });
      expect(res1.success).toBe(false);

      const res2 = CreateCompensationRevisionSchema.safeParse({
        baseSalary: 10_000_000,
        allowances: -500,
        effectiveFrom: '2026-08-01',
      });
      expect(res2.success).toBe(false);
    });
  });

  describe('3. Payroll Generation & Business Rules', () => {
    const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const EMPLOYEE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const mockWorkingDays = Array.from({ length: 23 }, (_, i) => ({
      work_date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      is_working_day: true,
      reason: 'regular_workday',
    }));

    it('fails closed with 422 PAYROLL_COMPENSATION_MISSING when employee lacks compensation', async () => {
      const existingRun = mockQueryChain({ data: null, error: null });
      rpcMock.mockResolvedValueOnce({ data: mockWorkingDays, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const emptyHistory = mockQueryChain({ data: [], error: null });

      fromMock
        .mockReturnValueOnce(existingRun)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(emptyHistory);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Bảng lương tháng 08/2026',
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('denies duplicate same-period payroll run creation (409 Conflict)', async () => {
      const existingRun = mockQueryChain({
        data: { id: RUN_ID, status: 'calculated' },
        error: null,
      });
      fromMock.mockReturnValueOnce(existingRun);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Bảng lương tháng 08/2026',
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('handles concurrent race condition on database unique constraint (409 Conflict)', async () => {
      const existingRunCheck = mockQueryChain({ data: null, error: null });
      rpcMock.mockResolvedValueOnce({ data: mockWorkingDays, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const compHistory = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '23000000.00',
            allowances: '1000000.00',
            effective_from: '2026-01-01',
            payroll_eligible: true,
          },
        ],
        error: null,
      });
      const monthlyReviews = mockQueryChain({ data: [], error: null });
      const createRunConflict = mockQueryChain({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "uq_payroll_runs_period_month"',
        },
      });

      fromMock
        .mockReturnValueOnce(existingRunCheck)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(compHistory)
        .mockReturnValueOnce(monthlyReviews)
        .mockReturnValueOnce(createRunConflict);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Bảng lương tháng 08/2026',
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('calculates payslip using calendar standard days, attendance penalty, and 250k bonus when eligible', async () => {
      const existingRun = mockQueryChain({ data: null, error: null });
      // 23 standard working days in calendar
      rpcMock.mockResolvedValueOnce({ data: mockWorkingDays, error: null });
      const activeEmployees = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            job_title: 'Developer',
            joined_date: '2026-01-01',
            left_date: null,
          },
        ],
        error: null,
      });
      const compHistory = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '23000000.00',
            allowances: '1500000.00',
            effective_from: '2026-01-01',
            payroll_eligible: true,
          },
        ],
        error: null,
      });
      const monthlyReviews = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            discipline_bonus_eligible: true,
            early_leave_makeup_confirmed: true,
          },
        ],
        error: null,
      });
      const createRun = mockQueryChain({
        data: { id: RUN_ID },
        error: null,
      });
      // 23 attendance records (full work), with 2 late arrivals: 1x 3 min (0 VND) and 1x 10 min (50,000 VND)
      const attendances = mockQueryChain({
        data: mockWorkingDays.map((d, index) => ({
          id: `att-${index}`,
          attendance_date: d.work_date,
          status: index === 0 || index === 1 ? 'late' : 'present',
          late_minutes: index === 0 ? 3 : index === 1 ? 10 : 0,
          early_leave_minutes: 0,
        })),
        error: null,
      });
      const insertPayslips = mockQueryChain({
        data: [{ id: 'ps-1' }],
        error: null,
      });
      const updateRun = mockQueryChain({ data: null, error: null });
      const runDetail = mockQueryChain({
        data: { id: RUN_ID, status: 'calculated' },
        error: null,
      });
      const runPayslips = mockQueryChain({ data: [], error: null });

      fromMock
        .mockReturnValueOnce(existingRun)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(compHistory)
        .mockReturnValueOnce(monthlyReviews)
        .mockReturnValueOnce(createRun)
        .mockReturnValueOnce(attendances)
        .mockReturnValueOnce(insertPayslips)
        .mockReturnValueOnce(updateRun)
        .mockReturnValueOnce(runDetail)
        .mockReturnValueOnce(runPayslips);

      const result = await service.generatePayrollRun(
        {
          periodMonth: '2026-08',
          title: 'Bảng lương tháng 08/2026',
        },
        makeUser({ role: 'accountant' }),
      );

      expect(result.id).toBe(RUN_ID);
      expect(insertPayslips.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          payroll_run_id: RUN_ID,
          user_id: EMPLOYEE_ID,
          standard_working_days: 23,
          actual_worked_days: 23,
          base_salary: 23_000_000,
          allowances: 1_500_000,
          attendance_penalty_amount: 50_000,
          attendance_bonus_amount: 250_000,
          attendance_bonus_eligible: true,
          late_occurrences: 2,
          late_minutes: 13,
          absence_days: 0,
          // earned_base (23M/23 * 23 = 23M) + allowances (1.5M) + bonus (250k) = 24,750,000
          gross_salary: 24_750_000,
          // deductions = 50k penalty
          deductions: 50_000,
          // net = 24,750,000 - 50,000 = 24,700,000
          net_salary: 24_700_000,
        }),
      ]);
    });

    it('prorates salary for mid-month joined employee based on eligible days', async () => {
      const existingRun = mockQueryChain({ data: null, error: null });
      rpcMock.mockResolvedValueOnce({ data: mockWorkingDays, error: null });
      const activeEmployees = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            job_title: 'Developer',
            joined_date: '2026-08-15',
            left_date: null,
          },
        ],
        error: null,
      });
      const compHistory = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '23000000.00',
            allowances: '0',
            effective_from: '2026-08-01',
            payroll_eligible: true,
          },
        ],
        error: null,
      });
      const monthlyReviews = mockQueryChain({ data: [], error: null });
      const createRun = mockQueryChain({ data: { id: RUN_ID }, error: null });

      // Working days from Aug 15 to Aug 31 are days 15..23 (9 days)
      const joinedWorkingDays = mockWorkingDays.filter(
        (d) => d.work_date >= '2026-08-15',
      );
      const attendances = mockQueryChain({
        data: joinedWorkingDays.map((d, index) => ({
          id: `att-${index}`,
          attendance_date: d.work_date,
          status: 'present',
          late_minutes: 0,
          early_leave_minutes: 0,
        })),
        error: null,
      });
      const insertPayslips = mockQueryChain({
        data: [{ id: 'ps-1' }],
        error: null,
      });
      const updateRun = mockQueryChain({ data: null, error: null });
      const runDetail = mockQueryChain({
        data: { id: RUN_ID, status: 'calculated' },
        error: null,
      });
      const runPayslips = mockQueryChain({ data: [], error: null });

      fromMock
        .mockReturnValueOnce(existingRun)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(compHistory)
        .mockReturnValueOnce(monthlyReviews)
        .mockReturnValueOnce(createRun)
        .mockReturnValueOnce(attendances)
        .mockReturnValueOnce(insertPayslips)
        .mockReturnValueOnce(updateRun)
        .mockReturnValueOnce(runDetail)
        .mockReturnValueOnce(runPayslips);

      await service.generatePayrollRun(
        {
          periodMonth: '2026-08',
          title: 'Bảng lương tháng 08/2026',
        },
        makeUser({ role: 'accountant' }),
      );

      // dailyRate = 23,000,000 / 23 = 1,000,000
      // 9 worked days -> earnedBase = 9,000,000
      expect(insertPayslips.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          standard_working_days: 23,
          actual_worked_days: joinedWorkingDays.length,
          base_salary: 23_000_000,
          gross_salary: 9_000_000 + 250_000, // earned base + attendance bonus
        }),
      ]);
    });
  });

  describe('4. Approval and Payment State Transitions', () => {
    const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('calls approve_payroll_run RPC and returns updated status', async () => {
      rpcMock.mockResolvedValueOnce({
        data: { id: RUN_ID, status: 'approved' },
        error: null,
      });

      const result = await service.approvePayrollRun(
        RUN_ID,
        makeUser({ role: 'accountant' }),
      );
      expect(result.status).toBe('approved');
      expect(rpcMock).toHaveBeenCalledWith('approve_payroll_run', {
        p_run_id: RUN_ID,
        p_approved_by: USER_ID,
      });
    });

    it('calls mark_payroll_run_paid RPC and returns updated status', async () => {
      rpcMock.mockResolvedValueOnce({
        data: { id: RUN_ID, status: 'paid' },
        error: null,
      });

      const result = await service.markPayrollPaid(
        RUN_ID,
        makeUser({ role: 'accountant' }),
      );
      expect(result.status).toBe('paid');
      expect(rpcMock).toHaveBeenCalledWith('mark_payroll_run_paid', {
        p_run_id: RUN_ID,
      });
    });
  });
});
