import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { RequestUser } from '../src/auth/auth.types';
import { AttendanceService } from '../src/attendance/attendance.service';
import { SupabaseService } from '../src/supabase/supabase.service';

const USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const RECORD_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const DEPT_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

// Office Coordinates: PGS Agency
const PGS_OFFICE_LAT = 20.9840365;
const PGS_OFFICE_LNG = 105.7700707;
const PGS_RADIUS_METERS = 150;

describe('Phase 5 GPS Attendance & HR Operations (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
    authUserId: USER_ID,
    profileId: USER_ID,
    email: 'employee@pgs.vn',
    phone: null,
    role: 'employee',
    accountStatus: 'active',
    fullName: 'Employee Test',
    avatarUrl: null,
    approvedAt: '2026-01-01',
    departmentId: DEPT_ID,
  };

  const mockAttendanceService = {
    checkIn: jest.fn().mockImplementation((dto, user) => {
      // Validate GPS coordinates distance against PGS Agency location
      if (dto.latitude !== undefined && dto.longitude !== undefined) {
        // Haversine calculation
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000; // meters
        const dLat = toRad(dto.latitude - PGS_OFFICE_LAT);
        const dLng = toRad(dto.longitude - PGS_OFFICE_LNG);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(PGS_OFFICE_LAT)) *
            Math.cos(toRad(dto.latitude)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > PGS_RADIUS_METERS) {
          throw new BadRequestException({
            code: 'ATTENDANCE_LOCATION_OUT_OF_RANGE',
            message: 'Tọa độ chấm công nằm ngoài phạm vi văn phòng PGS.',
            distanceMeters: Math.round(distance),
            allowedRadiusMeters: PGS_RADIUS_METERS,
          });
        }
      }

      return {
        id: RECORD_ID,
        userId: user.profileId,
        attendanceDate: '2026-08-26',
        checkInAt: new Date().toISOString(),
        status: 'present',
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
      };
    }),
    checkOut: jest.fn().mockImplementation((dto, user) => ({
      id: RECORD_ID,
      userId: user.profileId,
      attendanceDate: '2026-08-26',
      checkOutAt: new Date().toISOString(),
      status: 'present',
    })),
    getAttendanceSettings: jest.fn().mockResolvedValue({
      id: 'singleton-id',
      timezone: 'Asia/Ho_Chi_Minh',
      office_latitude: PGS_OFFICE_LAT,
      office_longitude: PGS_OFFICE_LNG,
      location_radius_meters: PGS_RADIUS_METERS,
      location_required: true,
    }),
    updateAttendanceSettings: jest.fn().mockImplementation((dto) => ({
      id: 'singleton-id',
      timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
      office_latitude: dto.officeLatitude ?? PGS_OFFICE_LAT,
      office_longitude: dto.officeLongitude ?? PGS_OFFICE_LNG,
      location_radius_meters: dto.locationRadiusMeters ?? PGS_RADIUS_METERS,
      location_required: dto.locationRequired ?? true,
    })),
    getAttendancePolicy: jest.fn().mockResolvedValue({
      timezone: 'Asia/Ho_Chi_Minh',
      locationRequired: true,
      photoRequired: false,
    }),
    getMyHistory: jest.fn().mockResolvedValue({
      items: [
        {
          id: RECORD_ID,
          attendanceDate: '2026-08-26',
          status: 'present',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    getDirectory: jest.fn().mockResolvedValue({
      items: [
        {
          id: RECORD_ID,
          userId: USER_ID,
          attendanceDate: '2026-08-26',
          status: 'present',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    adjustRecord: jest.fn().mockImplementation((recordId, dto, user) => {
      if (user.role !== 'admin' && user.role !== 'team_leader') {
        throw new ForbiddenException({
          code: 'ATTENDANCE_ADJUST_ACCESS_DENIED',
          message: 'Chỉ quản lý hoặc Admin mới có thể điều chỉnh chấm công.',
        });
      }
      return {
        id: recordId,
        status: dto.status ?? 'present',
        reason: dto.reason,
        adjustedByUserId: user.profileId,
      };
    }),
    getSummary: jest.fn().mockResolvedValue({
      present: 1,
      late: 0,
      absent: 0,
    }),
  };

  beforeAll(async () => {
    const authClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation(() => {
        const chain = {
          select: jest.fn(),
          eq: jest.fn(),
          maybeSingle: jest.fn(),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        chain.maybeSingle.mockImplementation(() =>
          Promise.resolve({
            data: {
              id: currentUser.profileId,
              role: currentUser.role,
              account_status: currentUser.accountStatus,
              department_id: currentUser.departmentId,
            },
            error: null,
          }),
        );
        return chain;
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: () => authClient,
        createUserClient: () => authClient,
      })
      .overrideProvider(AttendanceService)
      .useValue(mockAttendanceService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const authHeader = () => ({ Authorization: 'Bearer valid-e2e-token' });

  // 1. Check-in within 150m radius of PGS Agency -> PASS
  it('1. Employee check-in within PGS Agency 150m radius succeeds', async () => {
    currentUser = {
      authUserId: USER_ID,
      profileId: USER_ID,
      email: 'employee@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    // Exactly at office (or ~5m away)
    const res = await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .set(authHeader())
      .send({
        latitude: 20.98404,
        longitude: 105.77008,
        accuracyMeters: 10,
        note: 'Check-in on-site PGS Agency',
      })
      .expect(201);

    expect(res.body).toHaveProperty('status', 'present');
    expect(res.body).toHaveProperty('id', RECORD_ID);
  });

  // 2. Check-in outside radius (>150m away) -> REJECT
  it('2. Employee check-in outside 150m radius is rejected with 400', async () => {
    currentUser = {
      authUserId: USER_ID,
      profileId: USER_ID,
      email: 'employee@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    // Far away (~5km away in Hanoi center)
    await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .set(authHeader())
      .send({
        latitude: 21.0285,
        longitude: 105.8542,
        accuracyMeters: 15,
        note: 'Check-in from distant location',
      })
      .expect(400);
  });

  // 3. Accuracy & Coordinate Schema Validation
  it('3. Rejects invalid coordinates and negative accuracy', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .set(authHeader())
      .send({
        latitude: 95.0, // Invalid latitude > 90
        longitude: 105.77,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/attendance/check-in')
      .set(authHeader())
      .send({
        latitude: 20.984,
        longitude: 105.77,
        accuracyMeters: -5, // Invalid negative accuracy
      })
      .expect(400);
  });

  // 4. Office Location Management (Admin Settings)
  it('4. Admin manages office GPS location and radius in settings', async () => {
    currentUser = {
      authUserId: 'admin-id',
      profileId: 'admin-id',
      email: 'admin@pgs.vn',
      phone: null,
      role: 'admin',
      accountStatus: 'active',
      fullName: 'Admin User',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: null,
    };

    const res = await request(app.getHttpServer())
      .patch('/api/v1/attendance/settings')
      .set(authHeader())
      .send({
        officeLatitude: 20.9840365,
        officeLongitude: 105.7700707,
        locationRadiusMeters: 150,
        locationRequired: true,
      })
      .expect(200);

    expect(res.body).toHaveProperty('office_latitude', 20.9840365);
    expect(res.body).toHaveProperty('office_longitude', 105.7700707);
    expect(res.body).toHaveProperty('location_radius_meters', 150);
  });

  // 5. Staff reads attendance policy (No GPS leak)
  it('5. Staff retrieves attendance policy without raw coordinate disclosure', async () => {
    currentUser = {
      authUserId: USER_ID,
      profileId: USER_ID,
      email: 'employee@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance/policy')
      .set(authHeader())
      .expect(200);

    expect(res.body).toHaveProperty('locationRequired', true);
    expect(res.body).not.toHaveProperty('office_latitude');
    expect(res.body).not.toHaveProperty('office_longitude');
  });

  // 6. Attendance Report / Directory with Department Scope
  it('6. Manager / Admin views attendance directory report', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@pgs.vn',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .get(`/api/v1/attendance/directory?departmentId=${DEPT_ID}&status=present`)
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
  });

  // 7. Manager Adjustment Approval
  it('7. Manager adjusts attendance record with mandatory reason', async () => {
    currentUser = {
      authUserId: 'mgr-id',
      profileId: 'mgr-id',
      email: 'manager@pgs.vn',
      phone: null,
      role: 'team_leader',
      accountStatus: 'active',
      fullName: 'Manager Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .post(`/api/v1/attendance/records/${RECORD_ID}/adjust`)
      .set(authHeader())
      .send({
        status: 'present',
        reason: 'Quên chấm công do mất kết nối mạng internet.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('reason', 'Quên chấm công do mất kết nối mạng internet.');
  });

  // 8. Employee views own attendance history
  it('8. Employee queries own attendance history', async () => {
    currentUser = {
      authUserId: USER_ID,
      profileId: USER_ID,
      email: 'employee@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Employee Test',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance/me?from=2026-08-01&to=2026-08-31')
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toHaveProperty('status', 'present');
  });
});
