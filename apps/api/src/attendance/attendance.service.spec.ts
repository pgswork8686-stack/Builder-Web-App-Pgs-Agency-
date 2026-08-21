import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AttendanceService } from './attendance.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const AUTH_USER_ID = 'auth-user-id-123';
const RECORD_ID = 'record-uuid-1111';
const SETTINGS_ID = '44444444-4444-4444-8444-444444444444';

function canonicalSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: SETTINGS_ID,
    timezone: 'Asia/Ho_Chi_Minh',
    workday_start_time: '08:00:00',
    workday_end_time: '17:30:00',
    late_grace_minutes: 5,
    early_leave_grace_minutes: 5,
    location_required: false,
    photo_required: false,
    location_radius_meters: 100,
    office_latitude: 20.9768,
    office_longitude: 105.7725,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

function queryResult(
  result: { data?: any; count?: number | null; error?: any },
  terminal: 'maybeSingle' | 'single' = 'maybeSingle',
) {
  const query: any = {};
  const response = {
    data: null,
    error: null,
    ...result,
  };
  for (const method of [
    'select',
    'eq',
    'in',
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
  query[terminal] = jest.fn().mockResolvedValue(response);
  query.then = jest.fn((onFulfilled, onRejected) =>
    Promise.resolve(response).then(onFulfilled, onRejected),
  );
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
    it('rejects a null GPS coordinate at check-out when location is required', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({
            data: canonicalSettings({ location_required: true }),
          });
        }
        return queryResult({});
      });

      await expect(
        service.checkOut(
          { latitude: null, longitude: 105.8542 },
          user('employee'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'ATTENDANCE_LOCATION_REQUIRED' },
      });
      expect(client.from).not.toHaveBeenCalledWith('attendance_records');
      expect(client.rpc).not.toHaveBeenCalled();
    });

    it('rejects check-out without a photo session when photo evidence is required', async () => {
      client.from.mockImplementation((table: string) => {
        if (table === 'attendance_settings') {
          return queryResult({
            data: canonicalSettings({ photo_required: true }),
          });
        }
        return queryResult({});
      });

      await expect(
        service.checkOut({}, user('employee')),
      ).rejects.toMatchObject({
        response: { code: 'ATTENDANCE_PHOTO_REQUIRED' },
      });
      expect(client.from).not.toHaveBeenCalledWith('attendance_records');
      expect(client.rpc).not.toHaveBeenCalled();
    });

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

  describe('Team leader directory scope', () => {
    const TEAM_A = '55555555-5555-4555-8555-555555555555';
    const TEAM_B = '66666666-6666-4666-8666-666666666666';
    const OUTSIDE_TEAM = '77777777-7777-4777-8777-777777777777';

    it('scopes a leader to every team they lead and permits each team filter', async () => {
      const teamsQuery = queryResult({
        data: [{ id: TEAM_A }, { id: TEAM_B }],
      });
      const recordsQuery = queryResult({ data: [], count: 0 });
      client.from
        .mockReturnValueOnce(teamsQuery)
        .mockReturnValueOnce(recordsQuery);

      await expect(
        service.getDirectory(
          { page: 1, pageSize: 20, teamId: TEAM_B },
          user('team_leader'),
        ),
      ).resolves.toMatchObject({ items: [], total: 0 });

      expect(recordsQuery.in).toHaveBeenCalledWith(
        'profile.employee_profile.team_id',
        [TEAM_A, TEAM_B],
      );
      expect(recordsQuery.select).toHaveBeenCalledWith(
        expect.stringContaining(
          'profile:profiles!attendance_records_user_id_fkey!inner(',
        ),
        { count: 'exact' },
      );
      expect(recordsQuery.select).toHaveBeenCalledWith(
        expect.stringContaining(
          'employee_profile:employee_profiles!employee_profiles_user_id_fkey!inner(',
        ),
        { count: 'exact' },
      );
    });

    it('rejects a leader filter for a team outside their resolved scope', async () => {
      client.from.mockReturnValue(
        queryResult({ data: [{ id: TEAM_A }, { id: TEAM_B }] }),
      );

      await expect(
        service.getDirectory(
          { page: 1, pageSize: 20, teamId: OUTSIDE_TEAM },
          user('team_leader'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.from).toHaveBeenCalledTimes(1);
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

  describe('Canonical attendance settings', () => {
    it('allows only an admin to read or update settings', async () => {
      await expect(
        service.getAttendanceSettings(user('employee')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.updateAttendanceSettings(
          { photoRequired: true },
          user('client'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.from).not.toHaveBeenCalled();
    });

    it('reads the canonical singleton for an admin', async () => {
      const settings = canonicalSettings();
      client.from.mockReturnValue(queryResult({ data: settings }));

      await expect(
        service.getAttendanceSettings(user('admin')),
      ).resolves.toEqual(settings);
      expect(client.from).toHaveBeenCalledWith('attendance_settings');
    });

    it('maps a PATCH payload only to real nullable settings columns', async () => {
      const current = canonicalSettings();
      const updated = canonicalSettings({
        workday_start_time: null,
        workday_end_time: null,
        late_grace_minutes: null,
        early_leave_grace_minutes: null,
        location_radius_meters: null,
        office_latitude: null,
        office_longitude: null,
        photo_required: true,
      });
      const readQuery = queryResult({ data: current });
      const writeQuery = queryResult({ data: updated }, 'single');
      client.from
        .mockReturnValueOnce(readQuery)
        .mockReturnValueOnce(writeQuery);

      await expect(
        service.updateAttendanceSettings(
          {
            workdayStartTime: null,
            workdayEndTime: null,
            lateGraceMinutes: null,
            earlyLeaveGraceMinutes: null,
            locationRadiusMeters: null,
            officeLatitude: null,
            officeLongitude: null,
            photoRequired: true,
          },
          user('admin'),
        ),
      ).resolves.toEqual(updated);

      expect(writeQuery.update).toHaveBeenCalledWith({
        workday_start_time: null,
        workday_end_time: null,
        late_grace_minutes: null,
        early_leave_grace_minutes: null,
        photo_required: true,
        location_radius_meters: null,
        office_latitude: null,
        office_longitude: null,
      });
      expect(writeQuery.eq).toHaveBeenCalledWith('id', SETTINGS_ID);
    });

    it('rejects a final workday pair that is incomplete or out of order', async () => {
      const current = canonicalSettings();
      client.from.mockReturnValue(queryResult({ data: current }));

      await expect(
        service.updateAttendanceSettings(
          { workdayStartTime: '18:00:00' },
          user('admin'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a final GPS configuration with an unpaired coordinate', async () => {
      const current = canonicalSettings();
      client.from.mockReturnValue(queryResult({ data: current }));

      await expect(
        service.updateAttendanceSettings(
          { officeLatitude: null },
          user('admin'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a configured geofence before GPS can be mandatory', async () => {
      const current = canonicalSettings({
        office_latitude: null,
        office_longitude: null,
        location_radius_meters: null,
      });
      client.from.mockReturnValue(queryResult({ data: current }));

      await expect(
        service.updateAttendanceSettings(
          { locationRequired: true },
          user('admin'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns an internal-only redacted policy without geofence coordinates', async () => {
      client.from.mockReturnValue(queryResult({ data: canonicalSettings() }));

      const policy = await service.getAttendancePolicy(user('employee'));
      expect(policy).toMatchObject({
        timezone: 'Asia/Ho_Chi_Minh',
        locationRequired: false,
        photoRequired: false,
      });
      expect(policy).not.toHaveProperty('officeLatitude');
      expect(policy).not.toHaveProperty('officeLongitude');
      expect(policy).not.toHaveProperty('locationRadiusMeters');

      await expect(
        service.getAttendancePolicy(user('client')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Attendance policy calculation boundaries', () => {
    const boundarySettings = {
      timezone: 'Asia/Ho_Chi_Minh',
      workday_start_time: '08:00:00',
      workday_end_time: '17:30:00',
      late_grace_minutes: 5,
      early_leave_grace_minutes: 5,
    };

    it('treats 08:05 and 17:25 as within the configured grace periods', () => {
      const metrics = (service as any).calculateAttendanceMetrics(
        new Date('2026-08-21T01:05:00.000Z'),
        new Date('2026-08-21T10:25:00.000Z'),
        boundarySettings,
      );

      expect(metrics).toMatchObject({
        status: 'present',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
      });
    });

    it.each([
      ['07:59', '2026-08-21T00:59:00.000Z', 0],
      ['08:00', '2026-08-21T01:00:00.000Z', 0],
      ['08:05', '2026-08-21T01:05:00.000Z', 0],
      ['08:06', '2026-08-21T01:06:00.000Z', 6],
    ])(
      'calculates check-in %s against the configured 08:00 + 5-minute grace',
      (_label, isoTime, expectedLateMinutes) => {
        const metrics = (service as any).calculateAttendanceMetrics(
          new Date(isoTime),
          null,
          boundarySettings,
        );

        expect(metrics).toMatchObject({
          status: 'incomplete',
          lateMinutes: expectedLateMinutes,
          earlyLeaveMinutes: 0,
        });
      },
    );

    it.each([
      ['17:24', '2026-08-21T10:24:00.000Z', 6],
      ['17:25', '2026-08-21T10:25:00.000Z', 0],
      ['17:30', '2026-08-21T10:30:00.000Z', 0],
    ])(
      'calculates check-out %s against the configured 17:30 + 5-minute grace',
      (_label, isoTime, expectedEarlyLeaveMinutes) => {
        const metrics = (service as any).calculateAttendanceMetrics(
          new Date('2026-08-21T01:00:00.000Z'),
          new Date(isoTime),
          boundarySettings,
        );

        expect(metrics).toMatchObject({
          earlyLeaveMinutes: expectedEarlyLeaveMinutes,
        });
      },
    );

    it('marks 08:06 and 17:24 as late and early leave', () => {
      const metrics = (service as any).calculateAttendanceMetrics(
        new Date('2026-08-21T01:06:00.000Z'),
        new Date('2026-08-21T10:24:00.000Z'),
        boundarySettings,
      );

      expect(metrics).toMatchObject({
        status: 'late_and_early_leave',
        lateMinutes: 6,
        earlyLeaveMinutes: 6,
      });
    });

    it('uses the configured timezone rather than a hard-coded Vietnam timezone', () => {
      const metrics = (service as any).calculateAttendanceMetrics(
        new Date('2026-08-21T08:06:00.000Z'),
        null,
        {
          timezone: 'UTC',
          workday_start_time: '08:00:00',
          workday_end_time: '17:30:00',
          late_grace_minutes: 5,
          early_leave_grace_minutes: 5,
        },
      );

      expect(metrics).toMatchObject({ status: 'incomplete', lateMinutes: 6 });
    });

    it('does not invent late or early-leave metrics when policy times are null', () => {
      const metrics = (service as any).calculateAttendanceMetrics(
        new Date('2026-08-21T01:06:00.000Z'),
        new Date('2026-08-21T10:24:00.000Z'),
        {
          timezone: 'Asia/Ho_Chi_Minh',
          workday_start_time: null,
          workday_end_time: null,
          late_grace_minutes: null,
          early_leave_grace_minutes: null,
        },
      );

      expect(metrics).toMatchObject({
        status: 'present',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
      });
    });
  });
});
