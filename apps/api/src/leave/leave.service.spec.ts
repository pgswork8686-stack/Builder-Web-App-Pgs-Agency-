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
});
