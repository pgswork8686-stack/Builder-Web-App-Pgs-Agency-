/**
 * Authorization tests for SupportService. These mocks intentionally exercise
 * the service-role query paths so an HTTP role decorator is not the only
 * boundary protecting support tickets.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { SupportService } from './support.service';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TICKET_A = '55555555-5555-4555-8555-555555555555';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';

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

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_A,
    client_company_id: COMPANY_A,
    project_id: PROJECT_A,
    creator_user_id: OTHER_USER_ID,
    assignee_user_id: OTHER_USER_ID,
    title: 'Bug Report',
    status: 'open',
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
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('SupportService authorization', () => {
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

  it('returns 404 when a client reads a ticket from another company', async () => {
    const ticket = mockQueryChain({
      data: ticketRow({ client_company_id: COMPANY_B }),
      error: null,
    });
    const memberships = mockQueryChain({
      data: [{ client_company_id: COMPANY_A }],
      error: null,
    });
    fromMock.mockReturnValueOnce(ticket).mockReturnValueOnce(memberships);

    await expect(
      service.getTicketById(TICKET_A, makeUser({ role: 'client' })),
    ).rejects.toThrow(NotFoundException);
  });

  it('scopes a team leader ticket list to projects where they are project_manager', async () => {
    const memberships = mockQueryChain({
      data: [{ project_id: PROJECT_A }],
      error: null,
    });
    const tickets = mockQueryChain({
      data: [ticketRow()],
      error: null,
      count: 1,
    });
    fromMock.mockReturnValueOnce(memberships).mockReturnValueOnce(tickets);

    const result = await service.listTickets(
      { page: 1, pageSize: 20 },
      makeUser({ role: 'team_leader' }),
    );

    expect(tickets.in).toHaveBeenCalledWith('project_id', [PROJECT_A]);
    expect(result.items).toHaveLength(1);
  });

  it('returns an empty result for a team leader with no managed projects', async () => {
    const memberships = mockQueryChain({ data: [], error: null });
    fromMock.mockReturnValueOnce(memberships);

    await expect(
      service.listTickets(
        { page: 2, pageSize: 10 },
        makeUser({ role: 'team_leader' }),
      ),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('project_memberships');
  });

  it('scopes an employee ticket list to tickets they created or are assigned', async () => {
    const tickets = mockQueryChain({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(tickets);

    await service.listTickets(
      { page: 1, pageSize: 20 },
      makeUser({ role: 'employee' }),
    );

    expect(tickets.or).toHaveBeenCalledWith(
      `creator_user_id.eq.${USER_ID},assignee_user_id.eq.${USER_ID}`,
    );
  });

  it('keeps raw PostgREST delimiters in a search term from changing ticket scope', async () => {
    const tickets = mockQueryChain({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(tickets);
    const unsafeSearch = `owned),project_id.eq.${PROJECT_B}`;

    await service.listTickets(
      { page: 1, pageSize: 20, search: unsafeSearch },
      makeUser({ role: 'employee' }),
    );

    const safeSearch = `ownedproject_id.eq.${PROJECT_B}`;
    expect(tickets.or).toHaveBeenNthCalledWith(
      2,
      `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,ticket_code.ilike.%${safeSearch}%`,
    );
  });

  it('rejects a client-created ticket whose project belongs to a different company', async () => {
    const memberships = mockQueryChain({
      data: [{ client_company_id: COMPANY_A }],
      error: null,
    });
    const project = mockQueryChain({
      data: { id: PROJECT_B, client_company_id: COMPANY_B },
      error: null,
    });
    fromMock.mockReturnValueOnce(memberships).mockReturnValueOnce(project);

    await expect(
      service.createTicket(
        {
          clientCompanyId: COMPANY_A,
          projectId: PROJECT_B,
          title: 'Project access issue',
          description: 'This project does not belong to the selected company.',
          category: 'technical',
          priority: 'medium',
        },
        makeUser({ role: 'client' }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain(
      'support_tickets',
    );
  });

  it('uses the owned project company when a client creates a project ticket without a company id', async () => {
    const memberships = mockQueryChain({
      data: [{ client_company_id: COMPANY_A }],
      error: null,
    });
    const project = mockQueryChain({
      data: { id: PROJECT_A, client_company_id: COMPANY_A },
      error: null,
    });
    const ticketInsert = mockQueryChain({
      data: { id: TICKET_A, client_company_id: COMPANY_A },
      error: null,
    });
    fromMock
      .mockReturnValueOnce(memberships)
      .mockReturnValueOnce(project)
      .mockReturnValueOnce(ticketInsert);

    await expect(
      service.createTicket(
        {
          projectId: PROJECT_A,
          title: 'Project access issue',
          description: 'The client can create a ticket for its own project.',
          category: 'technical',
          priority: 'medium',
        },
        makeUser({ role: 'client' }),
      ),
    ).resolves.toEqual({ id: TICKET_A, client_company_id: COMPANY_A });
    expect(ticketInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_company_id: COMPANY_A,
        project_id: PROJECT_A,
      }),
    );
  });

  it('prevents an employee from reading or replying to a ticket they neither own nor are assigned', async () => {
    const ticketForRead = mockQueryChain({ data: ticketRow(), error: null });
    fromMock.mockReturnValueOnce(ticketForRead);

    await expect(
      service.getTicketById(TICKET_A, makeUser({ role: 'employee' })),
    ).rejects.toThrow(NotFoundException);

    const ticketForReply = mockQueryChain({ data: ticketRow(), error: null });
    fromMock.mockReturnValueOnce(ticketForReply);

    await expect(
      service.createMessage(
        TICKET_A,
        { content: 'Attempted reply', isInternalNote: false },
        makeUser({ role: 'employee' }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents a non-manager team leader from reading, replying to, or updating a ticket', async () => {
    const foreignTicket = ticketRow({ project_id: PROJECT_B });

    fromMock
      .mockReturnValueOnce(mockQueryChain({ data: foreignTicket, error: null }))
      .mockReturnValueOnce(mockQueryChain({ data: null, error: null }));
    await expect(
      service.getTicketById(TICKET_A, makeUser({ role: 'team_leader' })),
    ).rejects.toThrow(NotFoundException);

    fromMock
      .mockReturnValueOnce(mockQueryChain({ data: foreignTicket, error: null }))
      .mockReturnValueOnce(mockQueryChain({ data: null, error: null }));
    await expect(
      service.createMessage(
        TICKET_A,
        { content: 'Attempted reply', isInternalNote: false },
        makeUser({ role: 'team_leader' }),
      ),
    ).rejects.toThrow(NotFoundException);

    fromMock
      .mockReturnValueOnce(mockQueryChain({ data: foreignTicket, error: null }))
      .mockReturnValueOnce(mockQueryChain({ data: null, error: null }));
    await expect(
      service.updateStatus(
        TICKET_A,
        { status: 'in_progress' },
        makeUser({ role: 'team_leader' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a project-manager team leader to reply and update a ticket on their project', async () => {
    const leader = makeUser({ role: 'team_leader' });
    const managerMembership = () =>
      mockQueryChain({ data: { project_id: PROJECT_A }, error: null });

    const createdMessage = { id: 'message-id', content: 'We are checking.' };
    fromMock
      .mockReturnValueOnce(mockQueryChain({ data: ticketRow(), error: null }))
      .mockReturnValueOnce(managerMembership())
      .mockReturnValueOnce(
        mockQueryChain({ data: createdMessage, error: null }),
      );

    await expect(
      service.createMessage(
        TICKET_A,
        { content: 'We are checking.', isInternalNote: false },
        leader,
      ),
    ).resolves.toEqual(createdMessage);

    const updatedTicket = { ...ticketRow(), status: 'resolved' };
    const updateChain = mockQueryChain({ data: updatedTicket, error: null });
    fromMock
      .mockReturnValueOnce(mockQueryChain({ data: ticketRow(), error: null }))
      .mockReturnValueOnce(managerMembership())
      .mockReturnValueOnce(updateChain);

    await expect(
      service.updateStatus(TICKET_A, { status: 'resolved' }, leader),
    ).resolves.toEqual(updatedTicket);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' }),
    );
  });

  it('allows an admin to manage any ticket, including assignment', async () => {
    const updatedTicket = {
      ...ticketRow({ project_id: PROJECT_B }),
      status: 'in_progress',
      assignee_user_id: USER_ID,
    };
    const updateChain = mockQueryChain({ data: updatedTicket, error: null });
    fromMock
      .mockReturnValueOnce(
        mockQueryChain({
          data: ticketRow({ project_id: PROJECT_B }),
          error: null,
        }),
      )
      .mockReturnValueOnce(updateChain);

    await expect(
      service.updateStatus(
        TICKET_A,
        { status: 'in_progress', assigneeUserId: USER_ID },
        makeUser({ role: 'admin' }),
      ),
    ).resolves.toEqual(updatedTicket);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        assignee_user_id: USER_ID,
      }),
    );
  });

  it('denies employee status updates and accountant support access in the service layer', async () => {
    await expect(
      service.updateStatus(
        TICKET_A,
        { status: 'closed' },
        makeUser({ role: 'employee' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.listTickets(
        { page: 1, pageSize: 20 },
        makeUser({ role: 'accountant' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not let a team leader change ticket assignment', async () => {
    await expect(
      service.updateStatus(
        TICKET_A,
        { status: 'in_progress', assigneeUserId: OTHER_USER_ID },
        makeUser({ role: 'team_leader' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
