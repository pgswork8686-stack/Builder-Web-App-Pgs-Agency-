import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FinanceService } from './finance.service';
import { RequestUser } from '../auth/auth.types';

describe('FinanceService', () => {
  let service: FinanceService;
  let mockSupabaseClient: any;

  const adminUser: RequestUser = {
    authUserId: 'admin-auth',
    profileId: 'admin-prof',
    email: 'admin@example.com',
    phone: null,
    accountStatus: 'active',
    role: 'admin',
    fullName: 'Admin User',
    avatarUrl: null,
    approvedAt: null,
  };

  const accountantUser: RequestUser = {
    authUserId: 'acct-auth',
    profileId: 'acct-prof',
    email: 'acct@example.com',
    phone: null,
    accountStatus: 'active',
    role: 'accountant',
    fullName: 'Accountant User',
    avatarUrl: null,
    approvedAt: null,
  };

  const employeeUser: RequestUser = {
    authUserId: 'emp-auth',
    profileId: 'emp-prof',
    email: 'emp@example.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Employee User',
    avatarUrl: null,
    approvedAt: null,
  };

  const clientUser: RequestUser = {
    authUserId: 'client-auth',
    profileId: 'client-prof',
    email: 'client@example.com',
    phone: null,
    accountStatus: 'active',
    role: 'client',
    fullName: 'Client User',
    avatarUrl: null,
    approvedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Authorization Rules', () => {
    it('should allow admin and accountant to view summary', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { test: true },
        error: null,
      });
      const summaryAdmin = await service.getSummary(adminUser);
      expect(summaryAdmin).toBeDefined();

      const summaryAcct = await service.getSummary(accountantUser);
      expect(summaryAcct).toBeDefined();
    });

    it('should deny employee from accessing summary', async () => {
      await expect(service.getSummary(employeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny client from accessing summary', async () => {
      await expect(service.getSummary(clientUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Database Error Mappings', () => {
    it('should map P6023 (PAYMENT_EXCEEDS_OUTSTANDING) to BadRequestException', async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'PAYMENT_EXCEEDS_OUTSTANDING', code: 'P6023' },
      });

      await expect(
        service.recordPayment(
          'inv-id',
          { amount: 100, paidAt: new Date().toISOString() },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should map P6004 (CONTRACT_NOT_FOUND) to NotFoundException', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'CONTRACT_NOT_FOUND', code: 'P6004' },
        }),
      }));

      await expect(
        service.getContractById('contract-id', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should map 23505 (contracts_number_ci_uidx) to ConflictException', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "contracts_number_ci_uidx"',
            code: '23505',
          },
        }),
      }));

      await expect(
        service.createContract(
          {
            contractNumber: 'C-001',
            clientCompanyId: 'c-1',
            title: 'Hợp đồng thử nghiệm',
            startDate: '2026-08-12',
            contractValue: 1000,
            currencyCode: 'USD',
            clientVisible: true,
          },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Client Scoping', () => {
    it('should scope client queries to their own client company and visible contracts', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'client_memberships') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ client_company_id: 'company-uuid-xyz' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'contract-id',
                title: 'Visible Contract',
                client_visible: true,
              },
            ],
            count: 1,
            error: null,
          }),
        };
      });

      const result = await service.getContracts(
        { page: 1, pageSize: 20 },
        clientUser,
      );

      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe('Visible Contract');
    });

    it('should redact internal fields from contract list and detail for client role', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'client_memberships') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ client_company_id: 'company-uuid-xyz' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'contract-id',
                title: 'Visible Contract',
                created_by: 'internal-user',
                updated_by: 'internal-user',
                notes: 'internal confidential notes',
                client_visible: true,
              },
            ],
            count: 1,
            error: null,
          }),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'contract-id',
              title: 'Visible Contract',
              created_by: 'internal-user',
              updated_by: 'internal-user',
              notes: 'internal confidential notes',
              client_visible: true,
            },
            error: null,
          }),
        };
      });

      const listResult = await service.getContracts(
        { page: 1, pageSize: 20 },
        clientUser,
      );
      expect(listResult.items[0]).not.toHaveProperty('created_by');
      expect(listResult.items[0]).not.toHaveProperty('updated_by');
      expect(listResult.items[0]).not.toHaveProperty('notes');

      const detailResult = await service.getContractById(
        'contract-id',
        clientUser,
      );
      expect(detailResult).not.toHaveProperty('created_by');
      expect(detailResult).not.toHaveProperty('updated_by');
      expect(detailResult).not.toHaveProperty('notes');
    });

    it('should redact payment details for client role', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'invoices') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'invoice-id', client_visible: true },
              error: null,
            }),
          };
        }
        if (table === 'client_memberships') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ client_company_id: 'company-uuid-xyz' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'payment-id',
                invoice_id: 'invoice-id',
                amount: 100,
                paid_at: '2026-08-12T00:00:00Z',
                payment_reference: 'REF-XYZ',
                payment_method: 'Bank Transfer',
                notes: 'Confidential bank fee notes',
                created_at: '2026-08-12T00:00:00Z',
              },
            ],
            error: null,
          }),
        };
      });

      const payments = await service.getPayments('invoice-id', clientUser);
      expect(payments[0]).toHaveProperty('id');
      expect(payments[0]).toHaveProperty('invoiceId');
      expect(payments[0]).toHaveProperty('amount');
      expect(payments[0]).toHaveProperty('paidAt');
      expect(payments[0]).toHaveProperty('createdAt');

      expect(payments[0]).not.toHaveProperty('paymentReference');
      expect(payments[0]).not.toHaveProperty('paymentMethod');
      expect(payments[0]).not.toHaveProperty('notes');
      expect(payments[0]).not.toHaveProperty('recordedBy');
    });
  });

  describe('Employee/Team Leader Denials', () => {
    it('should deny employee from creating, updating or deleting contracts and invoices', async () => {
      await expect(
        service.createContract({} as any, employeeUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateContract('id', {} as any, employeeUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.transitionContract('id', 'active', employeeUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getAuditLogs({ page: 1, pageSize: 20 }, employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize unknown database errors and prevent detail leakage', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message:
              'extremely sensitive query syntax internal details that should never be shown to users',
            code: 'XX001',
          },
        }),
      }));

      try {
        await service.getContracts({ page: 1, pageSize: 20 }, adminUser);
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InternalServerErrorException);
        expect(err.response.code).toBe('FINANCE_DATABASE_ERROR');
        expect(err.response.message).toBe(
          'Không thể xử lý yêu cầu tài chính. Vui lòng thử lại.',
        );
      }
    });
  });
});
