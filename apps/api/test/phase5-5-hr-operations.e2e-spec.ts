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

const DEPT_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const EMP_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const RECORD_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

describe('Phase 5.5 HR Operation Validation (e2e)', () => {
  let app: INestApplication;
  let currentUser: RequestUser = {
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

  const mockAttendanceService = {
    checkIn: jest.fn().mockResolvedValue({
      id: RECORD_ID,
      userId: EMP_ID,
      attendanceDate: '2026-08-26',
      status: 'present',
    }),
    getMyHistory: jest.fn().mockResolvedValue({
      items: [
        {
          id: RECORD_ID,
          userId: EMP_ID,
          attendanceDate: '2026-08-26',
          status: 'present',
          checkInAt: '2026-08-26T08:00:00Z',
          checkOutAt: '2026-08-26T17:00:00Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    getDirectory: jest.fn().mockImplementation((query) => ({
      items: [
        {
          id: RECORD_ID,
          userId: EMP_ID,
          attendanceDate: '2026-08-26',
          status: query?.status ?? 'present',
          lateMinutes: 15,
          earlyLeaveMinutes: 0,
          workMinutes: 480,
          departmentId: query?.departmentId ?? DEPT_ID,
        },
      ],
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      total: 1,
      totalPages: 1,
    })),
    getSummary: jest.fn().mockResolvedValue({
      present: 20,
      late: 2,
      early_leave: 1,
      absent: 1,
      incomplete: 0,
      on_leave: 1,
      adjusted: 3,
      total_work_days: 22,
    }),
    adjustRecord: jest.fn().mockImplementation((recordId, dto, user) => {
      if (user.role !== 'admin' && user.role !== 'team_leader') {
        throw new ForbiddenException({
          code: 'ATTENDANCE_ADJUST_ACCESS_DENIED',
          message: 'Chỉ quản lý hoặc Admin mới có thể điều chỉnh chấm công.',
        });
      }
      if (!dto.reason || dto.reason.trim().length < 5) {
        throw new BadRequestException('Lý do điều chỉnh tối thiểu 5 ký tự.');
      }
      return {
        id: recordId,
        status: dto.status ?? 'present',
        reason: dto.reason,
        adjustedByUserId: user.profileId,
        adjustedAt: new Date().toISOString(),
      };
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

  // 1. Employee Lifecycle: Active employee with role and department can access HR operations
  it('1. Employee lifecycle: Active employee with assigned department accesses HR attendance', async () => {
    currentUser = {
      authUserId: EMP_ID,
      profileId: EMP_ID,
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
      .get('/api/v1/attendance/me')
      .set(authHeader())
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toHaveProperty('userId', EMP_ID);
  });

  // 2. Termination Lifecycle: Deactivated/Inactive employee is blocked by ActiveAccountGuard
  it('2. Termination lifecycle: Deactivated employee is blocked from login/API access', async () => {
    currentUser = {
      authUserId: EMP_ID,
      profileId: EMP_ID,
      email: 'terminated@pgs.vn',
      phone: null,
      role: 'employee',
      accountStatus: 'rejected', // Deactivated / Rejected
      fullName: 'Terminated Employee',
      avatarUrl: null,
      approvedAt: '2026-01-01',
      departmentId: DEPT_ID,
    };

    await request(app.getHttpServer())
      .get('/api/v1/attendance/me')
      .set(authHeader())
      .expect(403);
  });

  // 3. Attendance Adjustment Flow: Employee request / Manager approval & audit
  it('3. Attendance adjustment: Manager adjusts record with valid justification', async () => {
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
        reason: 'Đi gặp khách hàng tại địa điểm đối tác theo lịch công tác.',
      })
      .expect(201);

    expect(res.body).toHaveProperty('adjustedByUserId', 'mgr-id');
    expect(res.body).toHaveProperty('reason', 'Đi gặp khách hàng tại địa điểm đối tác theo lịch công tác.');
  });

  // 4. Monthly Attendance Reporting: Metrics calculation
  it('4. Monthly attendance reporting: Manager queries department attendance metrics and summary', async () => {
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

    // Directory list with department filter
    const dirRes = await request(app.getHttpServer())
      .get(`/api/v1/attendance/directory?departmentId=${DEPT_ID}&status=late&from=2026-08-01&to=2026-08-31`)
      .set(authHeader())
      .expect(200);

    expect(dirRes.body.items).toHaveLength(1);
    expect(dirRes.body.items[0]).toHaveProperty('lateMinutes', 15);

    // Summary metrics
    const summaryRes = await request(app.getHttpServer())
      .get('/api/v1/attendance/summary')
      .set(authHeader())
      .expect(200);

    expect(summaryRes.body).toHaveProperty('present', 20);
    expect(summaryRes.body).toHaveProperty('late', 2);
    expect(summaryRes.body).toHaveProperty('total_work_days', 22);
  });
});
