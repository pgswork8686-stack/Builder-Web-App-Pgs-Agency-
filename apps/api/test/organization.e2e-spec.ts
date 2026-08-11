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

function makeAdminProfile(id = ADMIN_UUID) {
  return {
    data: { id, role: 'admin', account_status: 'active' },
    error: null,
  };
}

function makeCompanyData(id = COMPANY_UUID) {
  return { data: { id, code: 'C1', name: 'Comp 1' }, error: null };
}

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

  // ----------------------------------------------------------------
  // ROUTING VERIFICATION
  // ----------------------------------------------------------------

  it('GET /api/v1/admin/people - resolves correctly (no double prefix)', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      return {};
    });

    mockSupabaseClient.rpc.mockResolvedValue({
      data: {
        items: [{ id: EMP_UUID, role: 'employee', account_status: 'active' }],
        total: 1,
      },
      error: null,
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/people')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  it('GET /api/v1/client/me/companies - resolves correctly', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: CLIENT_UUID,
              role: 'client',
              account_status: 'active',
            },
            error: null,
          }),
        };
      }
      if (table === 'client_memberships') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                client_company: {
                  id: COMPANY_UUID,
                  code: 'C1',
                  name: 'Comp 1',
                  status: 'active',
                },
                title: 'Director',
                is_primary: true,
                created_at: '2026-08-11T00:00:00.000Z',
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/client/me/companies')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: COMPANY_UUID,
      isPrimary: true,
    });
  });

  it('GET /api/v1/team/members - resolves correctly', async () => {
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

  // ----------------------------------------------------------------
  // RBAC
  // ----------------------------------------------------------------

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

  // ----------------------------------------------------------------
  // PEOPLE DIRECTORY — JSONB RPC PARAMS + RESPONSE
  // ----------------------------------------------------------------

  it('People Directory - passes filters correctly and parses JSONB items', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      return {};
    });

    mockSupabaseClient.rpc.mockResolvedValue({
      data: {
        items: [
          {
            id: EMP_UUID,
            email: 'test@example.com',
            role: 'employee',
            account_status: 'active',
            employee_code: 'PGS02',
          },
        ],
        total: 1,
      },
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

  // ----------------------------------------------------------------
  // PEOPLE DIRECTORY — EMPTY PAGE TOTAL (Fix Round 3)
  // ----------------------------------------------------------------

  it('People Directory - empty page still returns correct total', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      return {};
    });

    // RPC returns empty items but total=38 (offset beyond data)
    mockSupabaseClient.rpc.mockResolvedValue({
      data: { items: [], total: 38 },
      error: null,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/people?page=100&pageSize=20')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(38);
    expect(res.body.page).toBe(100);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.totalPages).toBe(2);
  });

  // ----------------------------------------------------------------
  // PEOPLE DIRECTORY — QUERY VALIDATION (Zod schema)
  // ----------------------------------------------------------------

  const adminSetup = () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      return {};
    });
  };

  it('Query validation - role=super_admin → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?role=super_admin')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - employmentStatus=working → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?employmentStatus=working')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - departmentId=abc → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?departmentId=abc')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - teamId=123 → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?teamId=123')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - page=0 → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?page=0')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - page=x → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?page=x')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - pageSize=101 → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?pageSize=101')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - pageSize=20abc → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?pageSize=20abc')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('Query validation - pageSize=100 → allowed (200)', async () => {
    adminSetup();
    mockSupabaseClient.rpc.mockResolvedValue({
      data: { items: [], total: 0 },
      error: null,
    });
    await request(app.getHttpServer())
      .get('/api/v1/admin/people?pageSize=100')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);
  });

  it('Query validation - q > 100 chars → 400', async () => {
    adminSetup();
    const longQuery = 'a'.repeat(101);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/people?q=${longQuery}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  // ----------------------------------------------------------------
  // PATCH {} → 400
  // ----------------------------------------------------------------

  it('PATCH membership with empty body {} → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/clients/${COMPANY_UUID}/members/${MEMBER_UUID}`)
      .send({})
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  it('PATCH company with empty body {} → 400', async () => {
    adminSetup();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/clients/${COMPANY_UUID}`)
      .send({})
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
  });

  // ----------------------------------------------------------------
  // PARTIAL PATCH semantics — _provided flags
  // ----------------------------------------------------------------

  it('PATCH membership - only isPrimary provided → p_is_primary_provided=true, p_title_provided=false', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      if (table === 'client_companies') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeCompanyData()),
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

  it('PATCH membership - only title provided → p_title_provided=true, p_is_primary_provided=false', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      if (table === 'client_companies') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeCompanyData()),
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
      .send({ title: 'Giám đốc' })
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'update_client_membership_atomic',
      {
        p_company_id: COMPANY_UUID,
        p_membership_id: MEMBER_UUID,
        p_title: 'Giám đốc',
        p_title_provided: true,
        p_is_primary: false,
        p_is_primary_provided: false,
      },
    );
  });

  // ----------------------------------------------------------------
  // CLIENT MEMBERSHIP — RPC errors
  // ----------------------------------------------------------------

  it('Membership POST - sanitizes all RPC error types', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeAdminProfile()),
        };
      }
      if (table === 'client_companies') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(makeCompanyData()),
        };
      }
      return {};
    });

    // Success
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: { id: 'm1', is_primary: true },
      error: null,
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, title: 'Director', isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(201);

    // USER_NOT_A_CLIENT → 400
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'USER_NOT_A_CLIENT', code: 'P0003' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(400);

    // MEMBERSHIP_DUPLICATE → 409
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'MEMBERSHIP_DUPLICATE', code: '23505' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/clients/${COMPANY_UUID}/members`)
      .send({ userId: CLIENT_UUID, isPrimary: true })
      .set('Authorization', 'Bearer fake-token')
      .expect(409);
  });
});
