import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const RECORD_ID = 'record-uuid-1111';
const REQUEST_ID = 'request-uuid-2222';

describe('Attendance & Leave Management API (e2e)', () => {
  let app: INestApplication;
  let mockSupabaseClient: any;

  beforeAll(async () => {
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-id-123', email: 'test@example.com' } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: USER_ID,
                email: 'test@example.com',
                role: 'employee',
                account_status: 'active',
              },
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      rpc: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
        createUserClient: jest.fn().mockReturnValue(mockSupabaseClient),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Attendance routes authorization & functionality', () => {
    it('POST /api/v1/attendance/check-in - authenticated internal employee checkin', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: USER_ID, role: 'employee', account_status: 'active' },
              error: null,
            }),
          };
        }
        if (table === 'attendance_settings') {
          return {
            select: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: { location_required: false } }),
          };
        }
        if (table === 'attendance_records') {
          return {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: { id: RECORD_ID } }),
          };
        }
        return {};
      });

      await request(app.getHttpServer())
        .post('/api/v1/attendance/check-in')
        .send({ note: 'E2E checkin' })
        .set('Authorization', 'Bearer fake-token')
        .expect(201);
    });

    it('GET /api/v1/attendance/me - list own attendance history', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: USER_ID, role: 'employee', account_status: 'active' },
              error: null,
            }),
          };
        }
        if (table === 'attendance_records') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: [{ id: RECORD_ID, user_id: USER_ID }],
              count: 1,
            }),
          };
        }
        return {};
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance/me?page=1&pageSize=10')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
    });
  });

  describe('Leave routes authorization & functionality', () => {
    it('POST /api/v1/leave/requests - create a leave request', async () => {
      const validUuid = '11111111-2222-3333-4444-555555555555';
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: USER_ID, role: 'employee', account_status: 'active' },
              error: null,
            }),
          };
        }
        if (table === 'leave_types') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: { id: validUuid, code: 'annual' } }),
          };
        }
        return {};
      });

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: { id: REQUEST_ID },
        error: null,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/leave/requests')
        .send({
          leaveTypeId: validUuid,
          startDate: '2026-08-17',
          endDate: '2026-08-21',
          reason: 'Holiday',
        })
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(201);
    });

    it('POST /api/v1/leave/requests/:id/review - denies non-admins/non-leaders', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: USER_ID, role: 'employee', account_status: 'active' },
              error: null,
            }),
          };
        }
        return {};
      });

      await request(app.getHttpServer())
        .post(`/api/v1/leave/requests/${REQUEST_ID}/review`)
        .send({ action: 'approved', reviewNote: 'Approved E2E' })
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    });
  });
});
