import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LeaveService } from './leave.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = 'request-uuid-1111';
const BALANCE_ID = 'balance-uuid-2222';

function user(role: 'admin' | 'team_leader' | 'employee' | 'client'): any {
  return {
    authUserId: 'auth-uid',
    profileId: USER_ID,
    role,
    accountStatus: 'active',
  };
}

describe('LeaveService', () => {
  let service: LeaveService;
  let client: { from: jest.Mock; rpc: jest.Mock };

  beforeEach(() => {
    client = {
      from: jest.fn(),
      rpc: jest.fn(),
    };
    service = new LeaveService({
      getSystemClient: () => client,
    } as unknown as SupabaseService);
  });

  describe('Create Leave Request', () => {
    it('creates a request and calculates standard workdays', async () => {
      client.rpc.mockResolvedValueOnce({
        data: { id: REQUEST_ID },
        error: null,
      });

      const res = await service.createRequest(
        {
          leaveTypeId: 'type-id',
          startDate: '2026-08-17',
          endDate: '2026-08-21',
          reason: 'Vacation',
        },
        user('employee'),
      );
      expect(res).toBeDefined();
    });

    it('rejects creation if date range is reversed', async () => {
      await expect(
        service.createRequest(
          {
            leaveTypeId: 'type-id',
            startDate: '2026-08-21',
            endDate: '2026-08-17',
          },
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if user is a client', async () => {
      await expect(
        service.createRequest(
          {
            leaveTypeId: 'type-id',
            startDate: '2026-08-17',
            endDate: '2026-08-21',
          },
          user('client'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects creation if request spans multiple years', async () => {
      await expect(
        service.createRequest(
          {
            leaveTypeId: 'type-id',
            startDate: '2026-12-28',
            endDate: '2027-01-03',
          },
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Review Leave Requests', () => {
    it('calls atomic RPC review function', async () => {
      client.rpc.mockResolvedValueOnce({
        data: { id: REQUEST_ID, status: 'approved' },
        error: null,
      });

      const res = await service.reviewRequest(
        REQUEST_ID,
        { action: 'approved', reviewNote: 'Approved note' },
        user('admin'),
      );
      expect(res).toMatchObject({ status: 'approved' });
      expect(client.rpc).toHaveBeenCalledWith('phase5_review_leave_request', {
        p_request_id: REQUEST_ID,
        p_reviewer_id: USER_ID,
        p_action: 'approved',
        p_review_note: 'Approved note',
      });
    });

    it('rejects self-review requests via RPC error code matching', async () => {
      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'LEAVE_SELF_REVIEW_DENIED' },
      });

      await expect(
        service.reviewRequest(
          REQUEST_ID,
          { action: 'approved' },
          user('admin'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review if balance is insufficient', async () => {
      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'LEAVE_INSUFFICIENT_BALANCE' },
      });

      await expect(
        service.reviewRequest(
          REQUEST_ID,
          { action: 'approved' },
          user('admin'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Adjust leave balances', () => {
    it('allows admin to adjust balances via RPC', async () => {
      client.rpc.mockResolvedValueOnce({
        data: { id: 'adjustment-id' },
        error: null,
      });

      const res = await service.adjustBalance(
        BALANCE_ID,
        { deltaDays: 2, reason: 'Year bonus' },
        user('admin'),
      );
      expect(res).toBeDefined();
    });

    it('denies adjustments for ordinary employees', async () => {
      await expect(
        service.adjustBalance(
          BALANCE_ID,
          { deltaDays: 2, reason: 'Year bonus' },
          user('employee'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // =========================================================
  // Phase 5 Fix Round 2 — Regression Contract Tests (R8–R15)
  // =========================================================

  describe('calculateTotalDays — UTC-safe inclusive calendar days (Fix Round 2)', () => {
    const calc = (start: string, end: string) =>
      (service as any).calculateTotalDays(start, end);

    it('R8: single day request returns 1', () => {
      expect(calc('2026-08-12', '2026-08-12')).toBe(1);
    });

    it('R9: 5-day weekday range returns 5 (Mon–Fri)', () => {
      // 2026-08-10 Mon → 2026-08-14 Fri = 5 calendar days
      expect(calc('2026-08-10', '2026-08-14')).toBe(5);
    });

    it('R10: includes Saturday and Sunday in count (no weekend exclusion)', () => {
      // 2026-08-14 Fri → 2026-08-17 Mon = 4 days (Fri, Sat, Sun, Mon)
      expect(calc('2026-08-14', '2026-08-17')).toBe(4);
    });

    it('R11: full week (Mon–Sun) returns 7', () => {
      // 2026-08-10 Mon → 2026-08-16 Sun = 7 days
      expect(calc('2026-08-10', '2026-08-16')).toBe(7);
    });

    it('R12: reversed range returns 0 (guard)', () => {
      expect(calc('2026-08-17', '2026-08-10')).toBe(0);
    });

    it('R13: cross-month boundary is handled correctly', () => {
      // 2026-08-30 → 2026-09-01 = 3 days
      expect(calc('2026-08-30', '2026-09-01')).toBe(3);
    });
  });

  describe('Leave request creation — multi-year guard (Fix Round 2)', () => {
    it('R14: rejects request spanning different calendar years', async () => {
      await expect(
        service.createRequest(
          {
            leaveTypeId: 'type-id',
            startDate: '2026-12-30',
            endDate: '2027-01-02',
          },
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Cancel leave — approved balance guard (Fix Round 2)', () => {
    it('R15: delegates cancel to phase5_cancel_leave_request RPC', async () => {
      client.rpc.mockResolvedValueOnce({
        data: { id: REQUEST_ID, status: 'cancelled' },
        error: null,
      });

      const res = await service.cancelRequest(REQUEST_ID, user('employee'));
      expect(res).toBeDefined();
      expect(client.rpc).toHaveBeenCalledWith(
        'phase5_cancel_leave_request',
        expect.objectContaining({
          p_request_id: REQUEST_ID,
          p_actor_profile_id: USER_ID,
        }),
      );
    });
  });

  // =========================================================
  // Phase 5 Fix Round 3 — Calendar RBAC Tests (T12–T16)
  // =========================================================

  describe('getCalendar RBAC (Fix Round 3)', () => {
    function makeQueryChain() {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
      };
      // Make it awaitable by the service
      chain.then = jest.fn((res: any) =>
        Promise.resolve({ data: [], error: null }).then(res),
      );
      return chain;
    }

    function mockSupabaseForCalendar(
      queryChain: any,
      teamData?: { id: string },
    ) {
      const teamQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: teamData ?? null,
          error: null,
        }),
      };
      const mockFrom = jest.fn((table: string) => {
        if (table === 'teams') return teamQuery;
        return queryChain;
      });
      jest
        .spyOn((service as any).supabaseService, 'getSystemClient')
        .mockReturnValue({ from: mockFrom, rpc: jest.fn() } as any);
      return { queryChain, teamQuery };
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('T12: accountant calendar scopes to self (eq user_id)', async () => {
      const queryChain = makeQueryChain();
      mockSupabaseForCalendar(queryChain);

      await service.getCalendar('2026-08-01', '2026-08-31', {
        ...user('employee'),
        role: 'accountant',
      });

      const eqCalls = queryChain.eq.mock.calls;
      expect(
        eqCalls.some((c: any[]) => c[0] === 'user_id' && c[1] === USER_ID),
      ).toBe(true);
    });

    it('T13: employee calendar scopes to self (eq user_id)', async () => {
      const queryChain = makeQueryChain();
      mockSupabaseForCalendar(queryChain);

      await service.getCalendar('2026-08-01', '2026-08-31', user('employee'));

      const eqCalls = queryChain.eq.mock.calls;
      expect(
        eqCalls.some((c: any[]) => c[0] === 'user_id' && c[1] === USER_ID),
      ).toBe(true);
    });

    it('T14: team_leader calendar scopes to own team (not user_id)', async () => {
      const queryChain = makeQueryChain();
      mockSupabaseForCalendar(queryChain, { id: 'team-uuid-1234' });

      await service.getCalendar(
        '2026-08-01',
        '2026-08-31',
        user('team_leader'),
      );

      // user_id eq must NOT be applied for a leader
      const eqCalls = queryChain.eq.mock.calls;
      expect(eqCalls.some((c: any[]) => c[0] === 'user_id')).toBe(false);
    });

    it('T15: admin calendar has no user_id filter (org-wide)', async () => {
      const queryChain = makeQueryChain();
      mockSupabaseForCalendar(queryChain);

      await service.getCalendar('2026-08-01', '2026-08-31', user('admin'));

      const eqCalls = queryChain.eq.mock.calls;
      expect(eqCalls.some((c: any[]) => c[0] === 'user_id')).toBe(false);
    });

    it('T16: client is denied from calendar', async () => {
      await expect(
        service.getCalendar('2026-08-01', '2026-08-31', user('client')),
      ).rejects.toThrow();
    });
  });
});
