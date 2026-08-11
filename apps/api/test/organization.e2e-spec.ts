import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

const ADMIN_UUID = '99999999-9999-9999-9999-999999999999';
const CLIENT_UUID = '88888888-8888-8888-8888-888888888888';
const LEADER_UUID = '77777777-7777-7777-7777-777777777777';
const EMP_UUID = '66666666-6666-6666-6666-666666666666';
const COMPANY_UUID = '11111111-1111-1111-1111-111111111111';
const MEMBER_UUID = '33333333-3333-3333-3333-333333333333';

describe('Organization & Client API (e2e)', () => {
  let app: INestApplication;
  let mockSupabaseClient: any;

  beforeAll(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-id-123', email: 'test@example.com' } },
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
                id: 'user-id-123',
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
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockReturnThis(),
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

  // --- ROUTING DOUBLE PREFIX VERIFICATION ---
  it('GET /api/v1/admin/people - must resolve correctly (no double prefix)', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    mockSupabaseClient.rpc.mockResolvedValue({
      data: [
        {
          id: EMP_UUID,
          total_count: '1',
          role: 'employee',
          account_status: 'active',
        },
      ],
      error: null,
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/people')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  it('GET /api/v1/client/me/companies - must resolve correctly', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: CLIENT_UUID, role: 'client', account_status: 'active' },
            error: null,
          }),
        };
      }
      if (table === 'client_memberships') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              { id: 'm1', client_company_id: COMPANY_UUID, is_primary: true },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    await request(app.getHttpServer())
      .get('/api/v1/client/me/companies')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  it('GET /api/v1/team/members - must resolve correctly', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: LEADER_UUID,
              role: 'team_leader',
              account_status: 'active',
            },
            error: null,
          }),
        };
      }
      if (table === 'teams') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'team-1', leader_user_id: LEADER_UUID },
            error: null,
          }),
        };
      }
      if (table === 'employee_profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({
            data: [
              {
                user_id: EMP_UUID,
                employee_code: 'PGS01',
                profile: { full_name: 'Emp' },
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    await request(app.getHttpServer())
      .get('/api/v1/team/members')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  // --- RBAC TESTS ---
  it('RBAC - Only admin can access admin departments', async () => {
    const roles = ['employee', 'team_leader', 'client', 'accountant'];
    for (const r of roles) {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-id', role: r, account_status: 'active' },
              error: null,
            }),
          };
        }
        return {};
      });
      await request(app.getHttpServer())
        .get('/api/v1/admin/departments')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    }
  });

  it('RBAC - Only team_leader can access team members', async () => {
    const roles = ['employee', 'client', 'accountant', 'admin'];
    for (const r of roles) {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-id', role: r, account_status: 'active' },
              error: null,
            }),
          };
        }
        return {};
      });
      await request(app.getHttpServer())
        .get('/api/v1/team/members')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    }
  });

  it('RBAC - Only client can access client me companies', async () => {
    const roles = ['employee', 'team_leader', 'accountant', 'admin'];
    for (const r of roles) {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-id', role: r, account_status: 'active' },
              error: null,
            }),
          };
        }
        return {};
      });
      await request(app.getHttpServer())
        .get('/api/v1/client/me/companies')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    }
  });

  // --- PEOPLE DIRECTORY DB RPC PARAMS PASSING ---
  it('People Directory - passes filters and pagination to DB RPC correctly', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    mockSupabaseClient.rpc.mockResolvedValue({
      data: [
        {
          id: EMP_UUID,
          email: 'test@example.com',
          role: 'employee',
          account_status: 'active',
          employee_code: 'PGS02',
          total_count: '1',
        },
      ],
      error: null,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/people?q=PGS02&role=employee&page=2&pageSize=10')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'search_people_directory',
      {
        p_query: 'PGS02',
        p_role: 'employee',
        p_department_id: null,
        p_team_id: null,
        p_employment_status: null,
        p_offset: 10,
        p_limit: 10,
      },
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].employeeProfile.employeeCode).toBe('PGS02');
  });

  // --- FIX ROUND 2: query validation ---
  it('People Directory - rejects q param longer than 100 chars with 400', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    const longQuery = 'a'.repeat(101);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/people?q=${longQuery}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('People Directory - rejects invalid page param with 400', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/people?page=abc')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  // --- FIX ROUND 2: PATCH {} -> 400 ---
  it('PATCH membership with empty body {} returns 400', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/clients/${COMPANY_UUID}/members/${MEMBER_UUID}`)
      .send({})
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('PATCH company with empty body {} returns 400', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      return {};
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/clients/${COMPANY_UUID}`)
      .send({})
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  // --- FIX ROUND 2: partial PATCH semantics _provided flags ---
  it('PATCH membership - only isPrimary provided, calls RPC with correct _provided flags', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      if (table === 'client_companies') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: COMPANY_UUID, code: 'C1', name: 'Comp 1' },
            error: null,
          }),
        };
      }
      return {};
    });

    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: { id: MEMBER_UUID },
      error: null,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/clients/${COMPANY_UUID}/members/${MEMBER_UUID}`)
      .send({ isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'update_client_membership_atomic',
      {
        p_company_id: COMPANY_UUID,
        p_membership_id: MEMBER_UUID,
        p_title: null,
        p_title_provided: false,
        p_is_primary: true,
        p_is_primary_provided: true,
      },
    );
  });

  // --- CLIENT MEMBERSHIP ATOMIC RPC CALLS & SANITIZATION ---
  it('Client Membership - calls atomic RPC and sanitizes error correctly', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: ADMIN_UUID, role: 'admin', account_status: 'active' },
            error: null,
          }),
        };
      }
      if (table === 'client_companies') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: COMPANY_UUID, code: 'C1', name: 'Comp 1' },
            error: null,
          }),
        };
      }
      return {};
    });

    // 1. Success membership creation
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: { id: 'm1', is_primary: true },
      error: null,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, title: 'Director', isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(201);

    // 2. Error handling: USER_NOT_A_CLIENT throws BadRequestException (400)
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'USER_NOT_A_CLIENT', code: 'P0003' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, title: 'Director', isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(400);

    // 3. Error handling: MEMBERSHIP_DUPLICATE throws ConflictException (409)
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'MEMBERSHIP_DUPLICATE', code: '23505' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, title: 'Director', isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(409);
  });
});
