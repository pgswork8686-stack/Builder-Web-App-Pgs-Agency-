import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AttendanceService } from './attendance.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const AUTH_USER_ID = 'auth-user-id-123';
const RECORD_ID = 'record-uuid-1111';

function queryResult(result: { data?: any; count?: number | null; error?: any }, terminal: 'maybeSingle' | 'single' = 'maybeSingle') {
  const query: any = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'insert', 'update', 'single', 'maybeSingle', 'limit', 'order', 'range']) {
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
    authUserId: AUTH_USER_ID,
    profileId: USER_ID,
    role,
    accountStatus: 'active',
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let client: { from: jest.Mock; rpc: jest.Mock };

  beforeEach(() => {
    client = {
      from: jest.fn(),
      rpc: jest.fn(),
    };
    service = new AttendanceService({
      getSystemClient: () => client,
    } as unknown as SupabaseService);
  });

  describe('Check-In logic', () => {
    it('saves a check-in successfully', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { timezone: 'Asia/Ho_Chi_Minh' } });
        }
        if (table === 'attendance_records') {
          return queryResult({ data: { id: RECORD_ID, user_id: USER_ID } });
        }
        return queryResult({});
      });

      const res = await service.checkIn(
        { latitude: 21.0285, longitude: 105.8542, accuracyMeters: 10 },
        user('employee'),
      );
      expect(res).toBeDefined();
    });

    it('rejects check-in if user is a client', async () => {
      await expect(
        service.checkIn({}, user('client')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects double check-in with duplicate constraint code 23505', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { timezone: 'Asia/Ho_Chi_Minh' } });
        }
        if (table === 'attendance_records') {
          return queryResult({ error: { code: '23505' } });
        }
        return queryResult({});
      });

      await expect(
        service.checkIn({}, user('employee')),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces location requirement policy when enabled', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { location_required: true } });
        }
        return queryResult({});
      });

      await expect(
        service.checkIn({}, user('employee')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Check-Out logic', () => {
    it('rejects check-out if check-in record does not exist', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({ data: null });
        }
        return queryResult({});
      });

      await expect(
        service.checkOut({}, user('employee')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects check-out if already checked out', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({ data: { id: RECORD_ID, check_in_at: new Date().toISOString(), check_out_at: new Date().toISOString() } });
        }
        return queryResult({});
      });

      await expect(
        service.checkOut({}, user('employee')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Admin adjustments', () => {
    it('allows admins to correct attendance records', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({ data: { id: RECORD_ID, check_in_at: new Date().toISOString() } });
        }
        if (table === 'attendance_adjustments') {
          return queryResult({ data: { id: 'adjustment-id' } });
        }
        return queryResult({});
      });

      const res = await service.adjustRecord(
        RECORD_ID,
        { checkInAt: new Date().toISOString(), checkOutAt: new Date().toISOString(), reason: 'Corrected log' },
        user('admin'),
      );
      expect(res).toBeDefined();
    });

    it('denies corrections for ordinary employees', async () => {
      await expect(
        service.adjustRecord(RECORD_ID, { reason: 'No' }, user('employee')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
