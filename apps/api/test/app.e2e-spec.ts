import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ConfigService } from './../src/config/config.service';
import { SupabaseService } from './../src/supabase/supabase.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  const systemClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  const userClient = {
    from: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getSystemClient: jest.fn().mockReturnValue(systemClient),
        createUserClient: jest.fn().mockReturnValue(userClient),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'pgs-hub-api',
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('should run under test environment (APP_ENV=test)', () => {
    const configService = app.get(ConfigService);
    expect(configService.appEnv).toBe('test');
    expect(process.env.APP_ENV).toBe('test');
  });

  it('/api/v1/auth/me (GET) returns 401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    expect(systemClient.auth.getUser).not.toHaveBeenCalled();
    expect(userClient.from).not.toHaveBeenCalled();
  });

  it('/api/v1/auth/me (GET) returns 200 after AuthGuard resolves the own profile', async () => {
    systemClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: '00000000-0000-4000-8000-000000000010',
          email: 'auth.e2e@example.com',
          phone: null,
        },
      },
      error: null,
    });

    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000010',
        email: 'auth.e2e@example.com',
        full_name: 'Auth E2E User',
        avatar_url: null,
        role: 'employee',
        account_status: 'active',
        approved_at: '2026-08-28T00:00:00.000Z',
        rejection_reason: null,
      },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    userClient.from.mockReturnValue({ select });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-auth-e2e-token')
      .expect(200);

    expect(systemClient.auth.getUser).toHaveBeenCalledWith(
      'valid-auth-e2e-token',
    );
    expect(userClient.from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith(
      'id',
      '00000000-0000-4000-8000-000000000010',
    );
    expect(response.body).toMatchObject({
      user: {
        id: '00000000-0000-4000-8000-000000000010',
        email: 'auth.e2e@example.com',
      },
      account: {
        status: 'active',
        role: 'employee',
      },
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
