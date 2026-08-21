import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateSupportTicketDto,
  CreateTicketMessageDto,
  SupportTicketQuery,
  UpdateTicketStatusDto,
} from './dto/support.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private handleDbError(error: any, message: string): never {
    this.logger.error(`${message}: ${error?.message ?? JSON.stringify(error)}`);
    throw new InternalServerErrorException({
      code: 'SUPPORT_DATABASE_ERROR',
      message,
    });
  }

  private denySupportAccess(): never {
    throw new ForbiddenException({
      code: 'SUPPORT_ACCESS_DENIED',
      message: 'Bạn không có quyền truy cập yêu cầu hỗ trợ này.',
    });
  }

  private ticketNotFound(): never {
    throw new NotFoundException({
      code: 'TICKET_NOT_FOUND',
      message: 'Không tìm thấy yêu cầu hỗ trợ.',
    });
  }

  private assertSupportParticipant(user: RequestUser): void {
    if (
      user.role !== 'admin' &&
      user.role !== 'team_leader' &&
      user.role !== 'employee' &&
      user.role !== 'client'
    ) {
      this.denySupportAccess();
    }
  }

  private assertTicketCreator(user: RequestUser): void {
    if (user.role !== 'admin' && user.role !== 'client') {
      this.denySupportAccess();
    }
  }

  private async getClientCompanyIds(profileId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('client_memberships')
      .select('client_company_id')
      .eq('user_id', profileId);

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra công ty của khách hàng.');
    }

    return (data || []).map((m: any) => m.client_company_id);
  }

  private async getManagedProjectIds(profileId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('project_memberships')
      .select('project_id')
      .eq('user_id', profileId)
      .eq('project_role', 'project_manager');

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra phạm vi dự án quản lý.');
    }

    return (data || []).map((membership: any) => membership.project_id);
  }

  private async isProjectManager(
    projectId: string,
    profileId: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('project_memberships')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', profileId)
      .eq('project_role', 'project_manager')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra phạm vi dự án quản lý.');
    }

    return Boolean(data);
  }

  private async assertTicketReadAccess(ticket: any, user: RequestUser) {
    this.assertSupportParticipant(user);

    if (user.role === 'admin') {
      return;
    }

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      if (!companyIds.includes(ticket.client_company_id)) {
        this.ticketNotFound();
      }
      return;
    }

    if (user.role === 'team_leader') {
      if (
        !ticket.project_id ||
        !(await this.isProjectManager(ticket.project_id, user.profileId))
      ) {
        this.ticketNotFound();
      }
      return;
    }

    if (
      ticket.creator_user_id !== user.profileId &&
      ticket.assignee_user_id !== user.profileId
    ) {
      this.ticketNotFound();
    }
  }

  private async assertTicketManageAccess(ticket: any, user: RequestUser) {
    if (user.role === 'admin') {
      return;
    }

    if (
      user.role !== 'team_leader' ||
      !ticket.project_id ||
      !(await this.isProjectManager(ticket.project_id, user.profileId))
    ) {
      this.denySupportAccess();
    }
  }

  private async getTicketForAccess(id: string) {
    const { data, error } = await this.client
      .from('support_tickets')
      .select(
        'id, client_company_id, project_id, creator_user_id, assignee_user_id',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra quyền yêu cầu hỗ trợ.');
    }
    if (!data) {
      this.ticketNotFound();
    }

    return data;
  }

  private async getProjectClientCompanyId(projectId: string): Promise<string> {
    const { data: project, error } = await this.client
      .from('projects')
      .select('id, client_company_id')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra dự án của yêu cầu hỗ trợ.');
    }
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án.',
      });
    }

    return project.client_company_id;
  }

  private rejectProjectCompanyMismatch(): never {
    throw new BadRequestException({
      code: 'SUPPORT_PROJECT_COMPANY_MISMATCH',
      message: 'Dự án phải thuộc cùng công ty khách hàng của yêu cầu hỗ trợ.',
    });
  }

  private emptyTicketPage(query: SupportTicketQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  async listTickets(query: SupportTicketQuery, user: RequestUser) {
    this.assertSupportParticipant(user);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    let clientCompanyIds: string[] | undefined;
    let managedProjectIds: string[] | undefined;

    if (user.role === 'client') {
      clientCompanyIds = await this.getClientCompanyIds(user.profileId);
      if (clientCompanyIds.length === 0) {
        return this.emptyTicketPage(query);
      }
    } else if (user.role === 'team_leader') {
      managedProjectIds = await this.getManagedProjectIds(user.profileId);
      if (managedProjectIds.length === 0) {
        return this.emptyTicketPage(query);
      }
    }

    let dbQuery = this.client
      .from('support_tickets')
      .select(
        '*, client_company:client_companies(id, name, client_company_code), project:projects(id, name, project_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, user_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, user_code)',
        { count: 'exact' },
      );

    if (clientCompanyIds) {
      dbQuery = dbQuery.in('client_company_id', clientCompanyIds);
    } else if (managedProjectIds) {
      dbQuery = dbQuery.in('project_id', managedProjectIds);
    } else if (user.role === 'employee') {
      dbQuery = dbQuery.or(
        `creator_user_id.eq.${user.profileId},assignee_user_id.eq.${user.profileId}`,
      );
    }

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.category) {
      dbQuery = dbQuery.eq('category', query.category);
    }
    if (query.priority) {
      dbQuery = dbQuery.eq('priority', query.priority);
    }
    if (query.clientCompanyId) {
      dbQuery = dbQuery.eq('client_company_id', query.clientCompanyId);
    }
    // `.or()` accepts raw PostgREST syntax; commas and parentheses could turn
    // a search value into an additional predicate, so remove those delimiters.
    const safeSearch = query.search?.trim().replace(/[(),]/g, '');
    if (safeSearch) {
      dbQuery = dbQuery.or(
        `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,ticket_code.ilike.%${safeSearch}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    dbQuery = dbQuery.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await dbQuery;
    if (error) {
      this.handleDbError(error, 'Không thể tải danh sách yêu cầu hỗ trợ.');
    }

    return {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async getTicketById(id: string, user: RequestUser) {
    this.assertSupportParticipant(user);

    const { data: ticket, error: ticketErr } = await this.client
      .from('support_tickets')
      .select(
        '*, client_company:client_companies(id, name, code), project:projects(id, name, project_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, account_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('id', id)
      .maybeSingle();

    if (ticketErr) {
      this.handleDbError(ticketErr, 'Không thể truy vấn yêu cầu hỗ trợ.');
    }
    if (!ticket) {
      this.ticketNotFound();
    }

    await this.assertTicketReadAccess(ticket, user);

    let msgQuery = this.client
      .from('support_ticket_messages')
      .select(
        '*, sender:profiles!support_ticket_messages_sender_user_id_fkey(id, full_name, email, account_code, role, avatar_url)',
      )
      .eq('ticket_id', id);

    // Filter out internal notes for client role
    if (user.role === 'client') {
      msgQuery = msgQuery.eq('is_internal_note', false);
    }

    msgQuery = msgQuery.order('created_at', { ascending: true });

    const { data: messages, error: msgErr } = await msgQuery;
    if (msgErr) {
      this.handleDbError(msgErr, 'Không thể tải hội thoại hỗ trợ.');
    }

    return {
      ...ticket,
      messages: messages || [],
    };
  }

  async createTicket(dto: CreateSupportTicketDto, user: RequestUser) {
    this.assertTicketCreator(user);

    let companyId = dto.clientCompanyId;
    let clientCompanyIds: string[] | undefined;

    if (user.role === 'client') {
      clientCompanyIds = await this.getClientCompanyIds(user.profileId);
      if (clientCompanyIds.length === 0) {
        throw new ForbiddenException({
          code: 'NO_CLIENT_COMPANY',
          message:
            'Tài khoản khách hàng chưa được liên kết với doanh nghiệp nào.',
        });
      }
      if (companyId && !clientCompanyIds.includes(companyId)) {
        this.denySupportAccess();
      }
    }

    if (dto.projectId) {
      const projectCompanyId = await this.getProjectClientCompanyId(
        dto.projectId,
      );
      if (companyId && companyId !== projectCompanyId) {
        this.rejectProjectCompanyMismatch();
      }
      if (
        user.role === 'client' &&
        !clientCompanyIds?.includes(projectCompanyId)
      ) {
        this.denySupportAccess();
      }
      companyId = projectCompanyId;
    }

    if (user.role === 'client') {
      companyId = companyId || clientCompanyIds![0];
    } else if (!companyId) {
      // For internal staff creating ticket on behalf of client, company is required
      const { data: firstCompany } = await this.client
        .from('client_companies')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (firstCompany) {
        companyId = firstCompany.id;
      } else {
        throw new NotFoundException({
          code: 'CLIENT_COMPANY_NOT_FOUND',
          message: 'Chưa có công ty khách hàng nào trong hệ thống.',
        });
      }
    }

    if (!companyId) {
      throw new NotFoundException({
        code: 'CLIENT_COMPANY_NOT_FOUND',
        message: 'Chưa có công ty khách hàng nào trong hệ thống.',
      });
    }

    const { data, error } = await this.client
      .from('support_tickets')
      .insert({
        client_company_id: companyId,
        project_id: dto.projectId || null,
        creator_user_id: user.profileId,
        title: dto.title,
        description: dto.description,
        category: dto.category || 'general',
        priority: dto.priority || 'medium',
        status: 'open',
      })
      .select(
        '*, client_company:client_companies(id, name, code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, account_code)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể tạo yêu cầu hỗ trợ.');
    }

    return data;
  }

  async createMessage(
    ticketId: string,
    dto: CreateTicketMessageDto,
    user: RequestUser,
  ) {
    this.assertSupportParticipant(user);
    const ticket = await this.getTicketForAccess(ticketId);
    await this.assertTicketReadAccess(ticket, user);

    const { data, error } = await this.client
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_user_id: user.profileId,
        content: dto.content,
        // Clients may never create internal-only messages.
        is_internal_note: user.role === 'client' ? false : dto.isInternalNote,
      })
      .select(
        '*, sender:profiles!support_ticket_messages_sender_user_id_fkey(id, full_name, email, account_code, role, avatar_url)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể gửi tin nhắn hỗ trợ.');
    }

    return data;
  }

  async updateStatus(
    id: string,
    dto: UpdateTicketStatusDto,
    user: RequestUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'team_leader') {
      this.denySupportAccess();
    }
    if (user.role === 'team_leader' && dto.assigneeUserId !== undefined) {
      throw new ForbiddenException({
        code: 'SUPPORT_ASSIGNMENT_DENIED',
        message: 'Chỉ Admin mới có quyền phân công yêu cầu hỗ trợ.',
      });
    }

    const ticket = await this.getTicketForAccess(id);
    await this.assertTicketManageAccess(ticket, user);

    const updatePayload: Record<string, any> = {
      status: dto.status,
    };

    if (dto.assigneeUserId !== undefined) {
      updatePayload.assignee_user_id = dto.assigneeUserId;
    }
    if (dto.status === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
    } else if (dto.status === 'closed') {
      updatePayload.closed_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from('support_tickets')
      .update(updatePayload)
      .eq('id', id)
      .select(
        '*, client_company:client_companies(id, name, code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, account_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, account_code)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể cập nhật trạng thái yêu cầu.');
    }

    return data;
  }
}
