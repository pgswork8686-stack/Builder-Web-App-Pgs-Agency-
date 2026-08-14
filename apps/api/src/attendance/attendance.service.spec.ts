import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AttendanceService } from './attendance.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const AUTH_USER_ID = 'auth-user-id-123';
const RECORD_ID = 'record-uuid-1111';

function queryResult(
  result: { data?: any; count?: number | null; error?: any },
  terminal: 'maybeSingle' | 'single' = 'maybeSingle',
) {
  const query: any = {};
  for (const method of [
    'select',
    'eq',
    'gte',
    'lte',
    'insert',
    'update',
    'single',
    'maybeSingle',
    'limit',
    'order',
    'range',
  ]) {
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
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID, user_id: USER_ID },
        error: null,
      });

      const res = await service.checkIn(
        { latitude: 21.0285, longitude: 105.8542, accuracyMeters: 10 },
        user('employee'),
      );
      expect(res).toBeDefined();
    });

    it('rejects check-in if user is a client', async () => {
      await expect(service.checkIn({}, user('client'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects double check-in with duplicate constraint code 23505', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { timezone: 'Asia/Ho_Chi_Minh' } });
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      await expect(service.checkIn({}, user('employee'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('enforces location requirement policy when enabled', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { location_required: true } });
        }
        return queryResult({});
      });

      await expect(service.checkIn({}, user('employee'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects check-in if coordinates are outside geofence', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({
            data: {
              office_latitude: 21.0285,
              office_longitude: 105.8542,
              location_radius_meters: 100,
            },
          });
        }
        return queryResult({});
      });

      await expect(
        service.checkIn(
          { latitude: 10.8231, longitude: 106.6297 },
          user('employee'),
        ),
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

      await expect(service.checkOut({}, user('employee'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects check-out if already checked out', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({
            data: {
              id: RECORD_ID,
              check_in_at: new Date().toISOString(),
              check_out_at: new Date().toISOString(),
            },
          });
        }
        return queryResult({});
      });

      await expect(service.checkOut({}, user('employee'))).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Admin adjustments', () => {
    it('allows admins to correct attendance records', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({
            data: { id: RECORD_ID, check_in_at: new Date().toISOString() },
          });
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID },
        error: null,
      });

      const res = await service.adjustRecord(
        RECORD_ID,
        {
          checkInAt: new Date().toISOString(),
          checkOutAt: new Date().toISOString(),
          reason: 'Corrected log',
        },
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

  // =========================================================
  // Phase 5 Fix Round 2 — Regression Contract Tests
  // =========================================================

  describe('Photo upload session (Fix Round 2)', () => {
    const mockStorageClient = {
      from: jest.fn().mockReturnValue({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage/signed', token: 'tok' },
          error: null,
        }),
      }),
    };

    beforeEach(() => {
      (service as any).supabaseService = {
        getSystemClient: () => ({
          ...client,
          storage: mockStorageClient,
        }),
      };
    });

    it('R1: rejects photo upload if fileSize > 5 MB', async () => {
      await expect(
        service.getPhotoUploadSignature(
          'photo.jpg',
          'image/jpeg',
          6000000,
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('R2: rejects photo upload if fileSize is 0', async () => {
      await expect(
        service.getPhotoUploadSignature(
          'photo.jpg',
          'image/jpeg',
          0,
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('R3: rejects photo upload with unsupported MIME type', async () => {
      await expect(
        service.getPhotoUploadSignature(
          'photo.gif',
          'image/gif',
          1000,
          user('employee'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('R4: rejects photo upload for client users', async () => {
      await expect(
        service.getPhotoUploadSignature(
          'photo.jpg',
          'image/jpeg',
          1000,
          user('client'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('R5: generates sanitized path without raw user filename', async () => {
      // Mock settings for getVietnamDate
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { timezone: 'Asia/Ho_Chi_Minh' } });
        }
        if (table === 'attendance_photo_upload_sessions') {
          return queryResult({ data: { id: 'session-id' } });
        }
        return queryResult({});
      });

      const result = await service.getPhotoUploadSignature(
        'malicious<script>.jpg',
        'image/jpeg',
        1024,
        user('employee'),
      );
      // Path must NOT contain the original filename
      expect(result.path).not.toContain('malicious');
      expect(result.path).toContain('evidence.jpg');
    });
  });

  describe('Adjustment omit semantics (Fix Round 2)', () => {
    it('R6: calls RPC with p_set_check_in=false when checkInAt is omitted', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({
            data: { id: RECORD_ID, check_in_at: new Date().toISOString() },
          });
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID },
        error: null,
      });

      await service.adjustRecord(
        RECORD_ID,
        { reason: 'Only reason, no times' },
        user('admin'),
      );
      expect(client.rpc).toHaveBeenCalled();
      const rpcArgs = client.rpc.mock.calls[0][1];
      expect(rpcArgs.p_set_check_in).toBe(false);
      expect(rpcArgs.p_set_check_out).toBe(false);
    });

    it('R7: calls RPC with p_set_check_in=true when checkInAt is provided', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({
            data: { id: RECORD_ID, check_in_at: new Date().toISOString() },
          });
        }
        return queryResult({});
      });

      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID },
        error: null,
      });

      await service.adjustRecord(
        RECORD_ID,
        {
          checkInAt: '2026-08-12T08:30:00+07:00',
          reason: 'Fix early',
        },
        user('admin'),
      );
      expect(client.rpc).toHaveBeenCalled();
      const rpcArgs = client.rpc.mock.calls[0][1];
      expect(rpcArgs.p_set_check_in).toBe(true);
    });
  });

  // =========================================================
  // Phase 5 Fix Round 3 — Regression Tests T5–T11
  // =========================================================

  describe('Exact photo session binding (Fix Round 3)', () => {
    function sessionResult(overrides: Record<string, any> = {}) {
      return {
        id: 'session-id',
        user_id: USER_ID,
        expected_path: 'attendance/user/2026/08/uuid/evidence.jpg',
        expected_mime: 'image/jpeg',
        expected_size: 102400,
        storage_bucket: 'attendance-evidence',
        expires_at: new Date(Date.now() + 60000).toISOString(),
        consumed_at: null,
        ...overrides,
      };
    }

    function mockSessionQuery(sessionData: any) {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_photo_upload_sessions') {
          return queryResult({ data: sessionData });
        }
        return queryResult({});
      });
    }

    function mockStorage(
      mime: string | null,
      size: number | null,
      name = 'evidence.jpg',
    ) {
      return {
        storage: {
          from: () => ({
            list: jest.fn().mockResolvedValue({
              data:
                size !== null
                  ? [{ name, metadata: { mimetype: mime, size } }]
                  : [],
              error: null,
            }),
          }),
        },
      };
    }

    it('T5: rejects when actual MIME differs from expected_mime in session', async () => {
      mockSessionQuery(sessionResult({ expected_mime: 'image/jpeg' }));
      (service as any).supabaseService = {
        getSystemClient: () => ({
          ...client,
          ...mockStorage('image/png', 102400),
        }),
      };

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T6: rejects when actual size differs from expected_size in session', async () => {
      mockSessionQuery(sessionResult({ expected_size: 102400 }));
      (service as any).supabaseService = {
        getSystemClient: () => ({
          ...client,
          ...mockStorage('image/jpeg', 999),
        }),
      };

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T6b: rejects a fuzzy Storage search result with a different object name', async () => {
      mockSessionQuery(sessionResult());
      (service as any).supabaseService = {
        getSystemClient: () => ({
          ...client,
          ...mockStorage('image/jpeg', 102400, 'evidence.jpg.backup'),
        }),
      };

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T6c: rejects an upload session bound to a different bucket', async () => {
      mockSessionQuery(sessionResult({ storage_bucket: 'other-bucket' }));

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T7: rejects session belonging to different user', async () => {
      mockSessionQuery(sessionResult({ user_id: 'other-user-id' }));

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('T8: rejects expired session', async () => {
      mockSessionQuery(
        sessionResult({
          expires_at: new Date(Date.now() - 1000).toISOString(),
        }),
      );

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T9: rejects already-consumed session', async () => {
      mockSessionQuery(
        sessionResult({ consumed_at: new Date().toISOString() }),
      );

      await expect(
        (service as any).verifyPhotoUploadSession('session-id', USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('T10: check-in RPC does NOT receive p_photo_path in payload', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: { timezone: 'Asia/Ho_Chi_Minh' } });
        }
        return queryResult({});
      });
      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID },
        error: null,
      });

      await service.checkIn({}, user('employee'));

      const rpcArgs = client.rpc.mock.calls[0][1];
      expect(rpcArgs).not.toHaveProperty('p_photo_path');
    });

    it('T11: check-out RPC does NOT receive p_photo_path in payload', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({ data: {} });
        }
        if (table === 'attendance_records') {
          return queryResult({
            data: {
              id: RECORD_ID,
              check_in_at: new Date(Date.now() - 3600000).toISOString(),
              check_out_at: null,
            },
          });
        }
        return queryResult({});
      });
      client.rpc.mockResolvedValueOnce({
        data: { id: RECORD_ID },
        error: null,
      });

      await service.checkOut({}, user('employee'));

      const rpcArgs = client.rpc.mock.calls[0][1];
      expect(rpcArgs).not.toHaveProperty('p_photo_path');
    });
  });
});
