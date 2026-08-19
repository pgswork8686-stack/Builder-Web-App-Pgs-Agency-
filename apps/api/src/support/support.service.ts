import {
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

  async listTickets(query: SupportTicketQuery, user: RequestUser) {
    let dbQuery = this.client
      .from('support_tickets')
      .select(
        '*, client_company:client_companies(id, name, client_company_code), project:projects(id, name, project_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, user_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, user_code)',
        { count: 'exact' },
      );

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      dbQuery = dbQuery.in('client_company_id', companyIds);
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
    if (query.search) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query.search}%,description.ilike.%${query.search}%,ticket_code.ilike.%${query.search}%`,
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
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
    const { data: ticket, error: ticketErr } = await this.client
      .from('support_tickets')
      .select(
        '*, client_company:client_companies(id, name, client_company_code), project:projects(id, name, project_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, user_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, user_code)',
      )
      .eq('id', id)
      .maybeSingle();

    if (ticketErr || !ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy yêu cầu hỗ trợ.',
      });
    }

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      if (!companyIds.includes(ticket.client_company_id)) {
        throw new NotFoundException({
          code: 'TICKET_NOT_FOUND',
          message: 'Không tìm thấy yêu cầu hỗ trợ.',
        });
      }
    }

    let msgQuery = this.client
      .from('support_ticket_messages')
      .select(
        '*, sender:profiles!support_ticket_messages_sender_user_id_fkey(id, full_name, email, user_code, role, avatar_url)',
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
    let companyId = dto.clientCompanyId;

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      if (companyIds.length === 0) {
        throw new ForbiddenException({
          code: 'NO_CLIENT_COMPANY',
          message:
            'Tài khoản khách hàng chưa được liên kết với doanh nghiệp nào.',
        });
      }
      companyId =
        companyId && companyIds.includes(companyId) ? companyId : companyIds[0];
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
        '*, client_company:client_companies(id, name, client_company_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, user_code)',
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
    // Verify ticket access first
    await this.getTicketById(ticketId, user);

    if (user.role === 'client' && dto.isInternalNote) {
      dto.isInternalNote = false; // Clients cannot create internal notes
    }

    const { data, error } = await this.client
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_user_id: user.profileId,
        content: dto.content,
        is_internal_note: dto.isInternalNote,
      })
      .select(
        '*, sender:profiles!support_ticket_messages_sender_user_id_fkey(id, full_name, email, user_code, role, avatar_url)',
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
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'SUPPORT_ACCESS_DENIED',
        message:
          'Khách hàng không có quyền thay đổi trạng thái quản trị ticket.',
      });
    }

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
        '*, client_company:client_companies(id, name, client_company_code), creator:profiles!support_tickets_creator_user_id_fkey(id, full_name, email, user_code), assignee:profiles!support_tickets_assignee_user_id_fkey(id, full_name, email, user_code)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể cập nhật trạng thái yêu cầu.');
    }

    return data;
  }
}
