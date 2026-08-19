/**
 * REAL-SERVICE AUTHORIZATION TESTS: SupportService
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupportService } from './support.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const TICKET_A = 'tick1111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'client',
    fullName: 'Client User',
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
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({
      data: response.data ?? [],
      error: response.error,
      count: response.count ?? 0,
    }),
    maybeSingle: jest.fn().mockResolvedValue(response),
    single: jest.fn().mockResolvedValue(response),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('SupportService — Real Authorization Logic', () => {
  let service: SupportService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  describe('Client IDOR Protection on Tickets', () => {
    it('throws NotFoundException when client attempts to read ticket of another company', async () => {
      const clientUser = makeUser({ role: 'client' });

      // Ticket belongs to COMPANY_B
      const ticketData = {
        id: TICKET_A,
        client_company_id: COMPANY_B,
        title: 'Bug Report',
        status: 'open',
      };

      fromMock.mockImplementation((table: string) => {
        if (table === 'support_tickets') {
          return mockQueryChain({ data: ticketData, error: null });
        }
        if (table === 'client_memberships') {
          // Client only belongs to COMPANY_A!
          return mockQueryChain({
            data: [{ client_company_id: COMPANY_A }],
            error: null,
          });
        }
        return mockQueryChain({ data: null, error: null });
      });

      await expect(service.getTicketById(TICKET_A, clientUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when client attempts to change ticket status directly', async () => {
      const clientUser = makeUser({ role: 'client' });

      await expect(
        service.updateStatus(TICKET_A, { status: 'closed' }, clientUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
