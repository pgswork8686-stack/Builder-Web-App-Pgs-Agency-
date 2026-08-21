/**
 * REAL-SERVICE AUTHORIZATION & INTEGRITY TESTS: PayrollService
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';
import { UpsertEmployeeCompensationSchema } from './dto/payroll.dto';

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
    it('throws ForbiddenException when employee tries to list payroll runs (14, 15)', async () => {
      const employeeUser = makeUser({ role: 'employee' });
      await expect(
        service.listPayrollRuns({ page: 1, pageSize: 20 }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when client tries to access payroll (14)', async () => {
      const clientUser = makeUser({ role: 'client' });
      await expect(
        service.listPayrollRuns({ page: 1, pageSize: 20 }, clientUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getPayrollRunById('some-run-id', clientUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.generatePayrollRun(
          { periodMonth: '2026-08', title: 'Payroll', standardWorkingDays: 22 },
          clientUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when team_leader tries to generate payroll run (15)', async () => {
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

  describe('2. Employee Compensation Settings (5)', () => {
    it.each([
      [{ baseSalary: 0, allowances: 0 }],
      [{ baseSalary: -1, allowances: 0 }],
      [{ baseSalary: 22_000_000, allowances: -1 }],
      [{ baseSalary: 22_000_000 }],
    ])('rejects invalid compensation schema payload: %o', (body) => {
      expect(UpsertEmployeeCompensationSchema.safeParse(body).success).toBe(
        false,
      );
    });

    it('denies an employee from changing compensation settings (15)', async () => {
      await expect(
        service.upsertEmployeeCompensation(
          USER_ID,
          { baseSalary: 22_000_000, allowances: 1_500_000 },
          makeUser({ role: 'employee' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an accountant to upsert employee compensation', async () => {
      const employeeLookup = mockQueryChain({
        data: { user_id: USER_ID, employment_status: 'active' },
        error: null,
      });
      const compensationUpsert = mockQueryChain({
        data: {
          user_id: USER_ID,
          base_salary: 22_000_000,
          allowances: 1_500_000,
        },
        error: null,
      });
      fromMock
        .mockReturnValueOnce(employeeLookup)
        .mockReturnValueOnce(compensationUpsert);

      await expect(
        service.upsertEmployeeCompensation(
          USER_ID,
          { baseSalary: 22_000_000, allowances: 1_500_000 },
          makeUser({ role: 'accountant' }),
        ),
      ).resolves.toMatchObject({
        user_id: USER_ID,
        base_salary: 22_000_000,
        allowances: 1_500_000,
      });
    });
  });

  describe('3. Payroll Generation & Duplicate Period Guard (1, 2, 3, 4, 5)', () => {
    const RUN_ID = '44444444-4444-4444-8444-444444444444';
    const EMPLOYEE_ID = '55555555-5555-4555-8555-555555555555';

    it('rejects payroll generation if an active employee lacks compensation (5)', async () => {
      const existingRunCheck = mockQueryChain({ data: null, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const missingCompensation = mockQueryChain({ data: [], error: null });
      fromMock
        .mockReturnValueOnce(existingRunCheck)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(missingCompensation);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Luong Thang 8',
            standardWorkingDays: 22,
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('denies duplicate same-period payroll run creation (2)', async () => {
      const existingRun = mockQueryChain({
        data: { id: RUN_ID, status: 'calculated' },
        error: null,
      });
      fromMock.mockReturnValueOnce(existingRun);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Luong Thang 8',
            standardWorkingDays: 22,
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('handles concurrent race condition on database unique constraint (3)', async () => {
      const existingRunCheck = mockQueryChain({ data: null, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const compensationSettings = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '20000000.00',
            allowances: '1000000.00',
          },
        ],
        error: null,
      });
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
        .mockReturnValueOnce(compensationSettings)
        .mockReturnValueOnce(createRunConflict);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Luong Thang 8',
            standardWorkingDays: 22,
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('successfully generates payroll run and payslips with accurate calculation (1, 4)', async () => {
      const existingRun = mockQueryChain({ data: null, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const compensationSettings = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '22000000.00',
            allowances: '1500000.00',
          },
        ],
        error: null,
      });
      const createRun = mockQueryChain({
        data: { id: RUN_ID },
        error: null,
      });
      const attendance = mockQueryChain({
        data: Array.from({ length: 11 }, (_, index) => ({
          id: `attendance-${index}`,
          attendance_date: '2026-08-01',
          status: 'present',
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
        .mockReturnValueOnce(compensationSettings)
        .mockReturnValueOnce(createRun)
        .mockReturnValueOnce(attendance)
        .mockReturnValueOnce(insertPayslips)
        .mockReturnValueOnce(updateRun)
        .mockReturnValueOnce(runDetail)
        .mockReturnValueOnce(runPayslips);

      const result = await service.generatePayrollRun(
        {
          periodMonth: '2026-08',
          title: 'Luong Thang 8',
          standardWorkingDays: 22,
        },
        makeUser({ role: 'accountant' }),
      );

      expect(result.id).toBe(RUN_ID);
      expect(insertPayslips.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          payroll_run_id: RUN_ID,
          user_id: EMPLOYEE_ID,
          standard_working_days: 22,
          actual_worked_days: 11,
          base_salary: 22_000_000,
          allowances: 1_500_000,
          gross_salary: 12_500_000,
          net_salary: 12_500_000,
        }),
      ]);
    });

    it('surfaces DB error and rolls back when payslip insertion fails (11)', async () => {
      const existingRun = mockQueryChain({ data: null, error: null });
      const activeEmployees = mockQueryChain({
        data: [{ user_id: EMPLOYEE_ID, job_title: 'Developer' }],
        error: null,
      });
      const compensationSettings = mockQueryChain({
        data: [
          {
            user_id: EMPLOYEE_ID,
            base_salary: '22000000.00',
            allowances: '1500000.00',
          },
        ],
        error: null,
      });
      const createRun = mockQueryChain({
        data: { id: RUN_ID },
        error: null,
      });
      const attendance = mockQueryChain({
        data: [],
        error: null,
      });
      const insertPayslipsFail = mockQueryChain({
        data: null,
        error: { message: 'DB payslip insert failed' },
      });
      const rollbackDeleteRun = mockQueryChain({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(existingRun)
        .mockReturnValueOnce(activeEmployees)
        .mockReturnValueOnce(compensationSettings)
        .mockReturnValueOnce(createRun)
        .mockReturnValueOnce(attendance)
        .mockReturnValueOnce(insertPayslipsFail)
        .mockReturnValueOnce(rollbackDeleteRun);

      await expect(
        service.generatePayrollRun(
          {
            periodMonth: '2026-08',
            title: 'Luong Thang 8',
            standardWorkingDays: 22,
          },
          makeUser({ role: 'accountant' }),
        ),
      ).rejects.toThrow(InternalServerErrorException);

      expect(rollbackDeleteRun.delete).toHaveBeenCalled();
    });
  });

  describe('4. State Transitions: Approve & Pay (6, 7, 8, 9, 10)', () => {
    const RUN_ID = '44444444-4444-4444-8444-444444444444';

    it('approves payroll run successfully from valid state (6)', async () => {
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

    it('rejects approval when run is already approved or paid (7)', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'PAYROLL_ALREADY_APPROVED' },
      });

      await expect(
        service.approvePayrollRun(RUN_ID, makeUser({ role: 'accountant' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('pays payroll run successfully from approved state (8)', async () => {
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

    it('rejects pay when payroll run is not approved (9)', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'PAYROLL_NOT_APPROVED' },
      });

      await expect(
        service.markPayrollPaid(RUN_ID, makeUser({ role: 'accountant' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects second pay attempt when already paid (10)', async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'PAYROLL_ALREADY_PAID' },
      });

      await expect(
        service.markPayrollPaid(RUN_ID, makeUser({ role: 'accountant' })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Personal Payslip Access Isolation (12, 13)', () => {
    it('allows employee to view own payslips strictly scoped to their user_id (12, 13)', async () => {
      const employeeUser = makeUser({ role: 'employee', profileId: USER_ID });
      const payslips = [
        {
          id: 'ps-1',
          user_id: USER_ID,
          gross_salary: 15000000,
          net_salary: 13500000,
        },
      ];

      const queryMock = mockQueryChain({ data: payslips, error: null });
      fromMock.mockReturnValueOnce(queryMock);

      const result = await service.getMyPayslips(employeeUser);
      expect(result.length).toBe(1);
      expect(result[0].user_id).toBe(USER_ID);
      expect(queryMock.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });
  });
});
