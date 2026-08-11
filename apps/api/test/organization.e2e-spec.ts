import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Organization & Client API (e2e)', () => {
  let app: INestApplication;
  let mockSupabaseClient: any;

  beforeAll(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-id-123',
              email: 'test@example.com',
            },
          },
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
                role: 'employee', // default non-admin role
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

  it('/api/v1/admin/departments (GET) - Blocked for non-admin (employee)', async () => {
    // Mock user client returns active employee profile
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'user-emp-123',
              role: 'employee',
              account_status: 'active',
            },
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
  });

  it('/api/v1/admin/departments (GET) - Allowed for admin', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'user-admin-123',
              role: 'admin',
              account_status: 'active',
            },
            error: null,
          }),
        };
      }
      if (table === 'departments') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'd1', code: 'SEO', name: 'SEO Dept' }],
            error: null,
          }),
        };
      }
      return {};
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/departments')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0].code).toBe('SEO');
  });
});
