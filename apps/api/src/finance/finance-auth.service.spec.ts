/**
 * REAL-SERVICE AUTHORIZATION TESTS: FinanceService
 *
 * Strategy: Mock ONLY the Supabase transport layer.
 * FinanceService itself is instantiated directly — no method mocking.
 * Tests drive real enforceAdminOrAccountant / enforceAuthorizedRoles logic.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const CONTRACT_A = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const INVOICE_A = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const COMPANY_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: '00000000-0000-0000-0000-000000000002',
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Test User',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any; count?: number }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: response.data ?? [], error: response.error, count: response.count ?? 0 }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('FinanceService — Real Authorization Logic (Supabase Transport Mocked)', () => {
  let service: FinanceService;
  let fromMock: jest.Mock;
  let rpcMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();
    rpcMock = jest.fn().mockResolvedValue({ data: null, error: null });

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
        rpc: rpcMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // =========================================================================
  // getContractById — Role enforcement tests
  // =========================================================================
  describe('getContractById — employee role enforcement', () => {
    it('throws ForbiddenException(FINANCE_ACCESS_DENIED) when employee tries to read contract', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      let caughtError: any;
      try {
        await service.getContractById(CONTRACT_A, employeeUser);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);
      expect(caughtError.response?.code).toBe('FINANCE_ACCESS_DENIED');
      // Must NOT query database at all - enforcement is synchronous
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException(FINANCE_ACCESS_DENIED) when team_leader tries to read contract', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });

      await expect(
        service.getContractById(CONTRACT_A, leaderUser),
      ).rejects.toThrow(ForbiddenException);

      // Confirmed: DB not called since synchronous guard throws first
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('returns contract for admin user (no client_company_id filter)', async () => {
      const adminUser = makeUser({ role: 'admin' });
      const contractRow = {
        id: CONTRACT_A,
        contract_number: 'HD-001',
        client_company_id: COMPANY_A,
        status: 'active',
        client_visible: true,
        client_company: { name: 'Client A' },
        project: null,
      };

      // DB query for contracts
      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: contractRow, error: null }),
      );

      const result = await service.getContractById(CONTRACT_A, adminUser);
      expect(result.id).toBe(CONTRACT_A);
      expect(fromMock).toHaveBeenCalledWith('contracts');
    });

    it('returns contract for accountant user', async () => {
      const accountantUser = makeUser({ role: 'accountant' });
      const contractRow = {
        id: CONTRACT_A,
        contract_number: 'HD-001',
        client_company_id: COMPANY_A,
        status: 'active',
        client_visible: true,
        client_company: { name: 'Client A' },
        project: null,
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: contractRow, error: null }),
      );

      const result = await service.getContractById(CONTRACT_A, accountantUser);
      expect(result.id).toBe(CONTRACT_A);
    });
  });

  // =========================================================================
  // getContractById — Client IDOR: client can only see their own company contract
  // =========================================================================
  describe('getContractById — client IDOR enforcement', () => {
    it('throws NotFoundException when client tries to access foreign company contract (IDOR)', async () => {
      const clientUser = makeUser({
        role: 'client',
        profileId: '66666666-6666-4666-8666-666666666666',
      });

      fromMock.mockImplementation((table: string) => {
        if (table === 'client_memberships') {
          return mockQueryChain({ data: [], error: null });
        }
        if (table === 'contracts') {
          return mockQueryChain({ data: null, error: null });
        }
        return mockQueryChain({ data: null, error: null });
      });

      await expect(
        service.getContractById(CONTRACT_A, clientUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns client-safe contract view when client belongs to matching company', async () => {
      const clientUser = makeUser({
        role: 'client',
        profileId: '66666666-6666-4666-8666-666666666666',
      });
      const contractRow = {
        id: CONTRACT_A,
        contract_number: 'HD-001',
        client_company_id: COMPANY_A,
        status: 'active',
        client_visible: true,
        title: 'Test Contract',
        contract_value: 10000000,
        currency_code: 'VND',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        client_company: { name: 'Client A' },
        project: { name: 'Project A' },
        notes: null,
      };

      fromMock.mockImplementation((table: string) => {
        if (table === 'client_memberships') {
          return mockQueryChain({
            data: [{ client_company_id: COMPANY_A }],
            error: null,
          });
        }
        if (table === 'contracts') {
          return mockQueryChain({ data: contractRow, error: null });
        }
        return mockQueryChain({ data: null, error: null });
      });

      const result = await service.getContractById(CONTRACT_A, clientUser);
      expect(result.id).toBe(CONTRACT_A);
      // Client view should not expose sensitive internal fields
      expect(result).not.toHaveProperty('created_by');
      expect(result).not.toHaveProperty('updated_by');
    });
  });

  // =========================================================================
  // getInvoiceById — Role enforcement tests
  // =========================================================================
  describe('getInvoiceById — role enforcement', () => {
    it('throws ForbiddenException(FINANCE_ACCESS_DENIED) when employee tries to read invoice', async () => {
      const employeeUser = makeUser({ role: 'employee' });

      await expect(
        service.getInvoiceById(INVOICE_A, employeeUser),
      ).rejects.toThrow(ForbiddenException);

      expect(fromMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException(FINANCE_ACCESS_DENIED) when team_leader tries to read invoice', async () => {
      const leaderUser = makeUser({ role: 'team_leader' });

      await expect(
        service.getInvoiceById(INVOICE_A, leaderUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when client tries to read invoice not matching their company', async () => {
      const clientUser = makeUser({
        role: 'client',
        profileId: '66666666-6666-4666-8666-666666666666',
      });

      fromMock.mockImplementation((table: string) => {
        if (table === 'client_memberships') {
          return mockQueryChain({ data: [], error: null });
        }
        if (table === 'invoices') {
          return mockQueryChain({ data: null, error: null });
        }
        return mockQueryChain({ data: null, error: null });
      });

      await expect(
        service.getInvoiceById(INVOICE_A, clientUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns invoice for admin without DB membership check', async () => {
      const adminUser = makeUser({ role: 'admin' });
      const invoiceRow = {
        id: INVOICE_A,
        invoice_number: 'INV-001',
        client_company_id: COMPANY_A,
        status: 'issued',
        client_visible: true,
        client_company: { name: 'Client A' },
        project: null,
        contract: null,
      };

      fromMock.mockReturnValueOnce(
        mockQueryChain({ data: invoiceRow, error: null }),
      );

      const result = await service.getInvoiceById(INVOICE_A, adminUser);
      expect(result.id).toBe(INVOICE_A);
      // Admin path: no client_memberships query
      expect(fromMock).toHaveBeenCalledTimes(1);
      expect(fromMock.mock.calls[0][0]).toBe('invoices');
    });
  });
});
