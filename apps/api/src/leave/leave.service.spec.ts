import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LeaveService } from './leave.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const REQUEST_ID = 'request-uuid-1111';
const BALANCE_ID = 'balance-uuid-2222';

function queryResult(result: { data?: any; count?: number | null; error?: any }, terminal: 'maybeSingle' | 'single' = 'maybeSingle') {
  const query: any = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'insert', 'update', 'single', 'maybeSingle', 'limit', 'order', 'range', 'or', 'in']) {
    query[method] = jest.fn(() => query);
  }
  query[terminal] = jest.fn().mockResolvedValue({
    data: null,
    error: null,
    ...result,
  });
  return query;
}

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
      client.from.mockImplementation((table: string) => {
        if (table === 'leave_types') {
          return queryResult({ data: { id: 'type-id', code: 'annual' } });
        }
        if (table === 'leave_requests') {
          // No overlaps
          return queryResult({ data: [] });
        }
        return queryResult({});
      });

      const res = await service.createRequest(
        { leaveTypeId: 'type-id', startDate: '2026-08-17', endDate: '2026-08-21', reason: 'Vacation' },
        user('employee'),
      );
      expect(res).toBeDefined();
    });

    it('rejects creation if date range is reversed', async () => {
      await expect(
        service.createRequest(
          { leaveTypeId: 'type-id', startDate: '2026-08-21', endDate: '2026-08-17' },
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation if user is a client', async () => {
      await expect(
        service.createRequest(
          { leaveTypeId: 'type-id', startDate: '2026-08-17', endDate: '2026-08-21' },
          user('client'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
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

    it('rejects self-review requests via RPC message mapping', async () => {
      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'LEAVE_SELF_REVIEW_DENIED' },
      });

      await expect(
        service.reviewRequest(REQUEST_ID, { action: 'approved' }, user('admin')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects review if balance is insufficient', async () => {
      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'LEAVE_INSUFFICIENT_BALANCE' },
      });

      await expect(
        service.reviewRequest(REQUEST_ID, { action: 'approved' }, user('admin')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Adjust leave balances', () => {
    it('allows admin to adjust balances', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'leave_balances') {
          return queryResult({ data: { id: BALANCE_ID, allocated_days: 12, adjusted_days: 0, used_days: 0 } });
        }
        if (table === 'leave_balance_adjustments') {
          return queryResult({ data: { id: 'adjustment-id' } });
        }
        return queryResult({});
      });

      const res = await service.adjustBalance(BALANCE_ID, { deltaDays: 2, reason: 'Year bonus' }, user('admin'));
      expect(res).toBeDefined();
    });

    it('denies adjustments for ordinary employees', async () => {
      await expect(
        service.adjustBalance(BALANCE_ID, { deltaDays: 2, reason: 'Year bonus' }, user('employee')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
