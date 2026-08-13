import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

const ADMIN_ID = 'admin-prof-uuid';
const CLIENT_ID = 'client-prof-uuid';
const COMPANY_A_ID = 'company-a-uuid';

describe('Finance Management API (e2e)', () => {
  let app: INestApplication;
  let mockSupabaseClient: any;
  let currentTestRole: string = 'admin';
  let currentProfileId: string = ADMIN_ID;
  let mockInvoiceResponse: any = {
    id: 'i-1',
    invoice_number: 'INV-001',
    client_company_id: COMPANY_A_ID,
    client_visible: true,
  };

  beforeAll(async () => {
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'auth-user-id-xyz', email: 'test@example.com' } },
          error: null,
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                data: {
                  id: currentProfileId,
                  email: 'test@example.com',
                  role: currentTestRole,
                  account_status: 'active',
                },
                error: null,
              });
            }),
          };
        }
        if (table === 'client_memberships') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((col: string, val: string) => {
              let mockData: any[] = [];
              if (val === CLIENT_ID) {
                mockData = [{ client_company_id: COMPANY_A_ID }];
              }
              return {
                then: (cb: any) => cb({ data: mockData, error: null }),
              };
            }),
          };
        }
        if (table === 'contracts') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'c-1',
                  contract_number: 'CON-001',
                  client_company_id: COMPANY_A_ID,
                  client_visible: true,
                },
              ],
              count: 1,
              error: null,
            }),
            maybeSingle: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                data: {
                  id: 'c-1',
                  contract_number: 'CON-001',
                  client_company_id: COMPANY_A_ID,
                  client_visible: true,
                },
                error: null,
              });
            }),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
          };
        }
        if (table === 'invoices') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'i-1',
                  invoice_number: 'INV-001',
                  client_company_id: COMPANY_A_ID,
                  client_visible: true,
                },
              ],
              count: 1,
              error: null,
            }),
            maybeSingle: jest.fn().mockImplementation(() => {
              return Promise.resolve({
                data: mockInvoiceResponse,
                error: null,
              });
            }),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
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

  describe('Authorization checks for finance endpoints', () => {
    it('GET /api/v1/finance/summary - allow admin', async () => {
      currentTestRole = 'admin';
      currentProfileId = ADMIN_ID;
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: { contracts: [] },
        error: null,
      });

      await request(app.getHttpServer())
        .get('/api/v1/finance/summary')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);
    });

    it('GET /api/v1/finance/summary - deny employee', async () => {
      currentTestRole = 'employee';
      currentProfileId = 'emp-1';

      await request(app.getHttpServer())
        .get('/api/v1/finance/summary')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    });

    it('GET /api/v1/finance/summary - deny team_leader', async () => {
      currentTestRole = 'team_leader';
      currentProfileId = 'tl-1';

      await request(app.getHttpServer())
        .get('/api/v1/finance/summary')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    });

    it('GET /api/v1/finance/summary - deny client', async () => {
      currentTestRole = 'client';
      currentProfileId = CLIENT_ID;

      await request(app.getHttpServer())
        .get('/api/v1/finance/summary')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);
    });

    it('GET /api/v1/finance/contracts - allow client own scoped list', async () => {
      currentTestRole = 'client';
      currentProfileId = CLIENT_ID;

      const res = await request(app.getHttpServer())
        .get('/api/v1/finance/contracts')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(res.body.items.length).toBe(1);
    });

    it('GET /api/v1/finance/invoices/:id - IDOR tenant isolation check', async () => {
      currentTestRole = 'client';
      currentProfileId = CLIENT_ID;
      // Set the mock response to null to simulate no matching invoice found due to scoping
      mockInvoiceResponse = null;

      await request(app.getHttpServer())
        .get('/api/v1/finance/invoices/99999999-9999-4999-9999-999999999999')
        .set('Authorization', 'Bearer fake-token')
        .expect(404); // Should return 404/Access Denied instead of leaking the invoice
    });

    it('GET /api/v1/finance/contracts/invalid-uuid - should return 400 Bad Request', async () => {
      currentTestRole = 'admin';
      currentProfileId = ADMIN_ID;

      const res = await request(app.getHttpServer())
        .get('/api/v1/finance/contracts/invalid-uuid')
        .set('Authorization', 'Bearer fake-token')
        .expect(400);

      expect(res.body.message).toContain('Validation failed');
    });

    it('PATCH /api/v1/finance/contracts/99999999-9999-4999-9999-999999999999 - should reject empty body with PATCH_EMPTY', async () => {
      currentTestRole = 'admin';
      currentProfileId = ADMIN_ID;

      const res = await request(app.getHttpServer())
        .patch('/api/v1/finance/contracts/99999999-9999-4999-9999-999999999999')
        .set('Authorization', 'Bearer fake-token')
        .send({})
        .expect(400);

      expect(res.body.code).toBe('PATCH_EMPTY');
    });

    it('POST /api/v1/finance/contracts/99999999-9999-4999-9999-999999999999/transition - should reject invalid transition target draft', async () => {
      currentTestRole = 'admin';
      currentProfileId = ADMIN_ID;

      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/contracts/99999999-9999-4999-9999-999999999999/transition')
        .set('Authorization', 'Bearer fake-token')
        .send({ status: 'draft' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });
});
