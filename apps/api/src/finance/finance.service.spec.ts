import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
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
  });
});
