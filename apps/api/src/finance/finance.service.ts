import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from '../auth/auth.types';
import {
  ContractCreateDto,
  ContractUpdateDto,
  InvoiceCreateDto,
  InvoiceUpdateDto,
  PaymentRecordDto,
  FinanceQuery,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private getVietnamDateOnly(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Unable to derive Vietnam business date');
    }

    return `${year}-${month}-${day}`;
  }

  private enforceAdminOrAccountant(user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'FINANCE_ACCESS_DENIED',
        message: 'Bạn không có quyền thực hiện chức năng tài chính này.',
      });
    }
  }

  private enforceAuthorizedRoles(user: RequestUser) {
    if (
      user.role !== 'admin' &&
      user.role !== 'accountant' &&
      user.role !== 'client'
    ) {
      throw new ForbiddenException({
        code: 'FINANCE_ACCESS_DENIED',
        message: 'Bạn không có quyền truy cập dữ liệu tài chính.',
      });
    }
  }

  private async getClientCompanyIds(profileId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('client_memberships')
      .select('client_company_id')
      .eq('user_id', profileId);

    if (error) {
      throw new InternalServerErrorException({
        code: 'FINANCE_ACCESS_DENIED',
        message: 'Không thể truy vấn thông tin công ty khách hàng liên kết.',
      });
    }

    return (data || []).map((m) => m.client_company_id);
  }

  private handleDbError(error: any) {
    const msg = error.message || '';
    const code = error.code || '';

    // Log the real database error on the server side
    this.logger.error(
      `Database error encountered: Code: ${code}, Message: ${msg}, Details: ${JSON.stringify(error)}`,
    );

    if (code === '23505') {
      if (
        msg.includes('contracts_number_ci_uidx') ||
        msg.includes('contracts')
      ) {
        throw new ConflictException({
          code: 'CONTRACT_NUMBER_DUPLICATE',
          message: 'Mã số hợp đồng đã tồn tại trong hệ thống.',
        });
      }
      if (msg.includes('invoices_number_ci_uidx') || msg.includes('invoices')) {
        throw new ConflictException({
          code: 'INVOICE_NUMBER_DUPLICATE',
          message: 'Mã số hóa đơn đã tồn tại trong hệ thống.',
        });
      }
      if (
        msg.includes('invoice_payments_reference_ci_uidx') ||
        msg.includes('invoice_payments')
      ) {
        throw new ConflictException({
          code: 'PAYMENT_REFERENCE_DUPLICATE',
          message: 'Mã tham chiếu thanh toán này đã tồn tại cho hóa đơn này.',
        });
      }
      throw new ConflictException({
        code: 'DUPLICATE_KEY',
        message: 'Dữ liệu bị trùng lặp.',
      });
    }

    if (msg.includes('CONTRACT_PROJECT_CLIENT_MISMATCH') || code === 'P6002') {
      throw new BadRequestException({
        code: 'CONTRACT_PROJECT_CLIENT_MISMATCH',
        message: 'Dự án và Công ty khách hàng không khớp nhau.',
      });
    }
    if (msg.includes('INVOICE_PROJECT_CLIENT_MISMATCH') || code === 'P6003') {
      throw new BadRequestException({
        code: 'INVOICE_PROJECT_CLIENT_MISMATCH',
        message: 'Dự án và Công ty khách hàng của hóa đơn không khớp nhau.',
      });
    }
    if (msg.includes('INVOICE_CONTRACT_CLIENT_MISMATCH') || code === 'P6005') {
      throw new BadRequestException({
        code: 'INVOICE_CONTRACT_CLIENT_MISMATCH',
        message: 'Hợp đồng và Công ty khách hàng của hóa đơn không khớp nhau.',
      });
    }
    if (msg.includes('INVOICE_CONTRACT_PROJECT_MISMATCH') || code === 'P6006') {
      throw new BadRequestException({
        code: 'INVOICE_CONTRACT_PROJECT_MISMATCH',
        message: 'Hợp đồng và Dự án của hóa đơn không khớp nhau.',
      });
    }
    if (
      msg.includes('INVOICE_CONTRACT_CURRENCY_MISMATCH') ||
      code === 'P6007'
    ) {
      throw new BadRequestException({
        code: 'INVOICE_CONTRACT_CURRENCY_MISMATCH',
        message: 'Loại tiền tệ của hóa đơn và hợp đồng không khớp nhau.',
      });
    }
    if (msg.includes('INVOICE_CONTRACT_CANCELLED') || code === 'P6008') {
      throw new BadRequestException({
        code: 'INVOICE_CONTRACT_CANCELLED',
        message: 'Không thể tạo hoặc sửa hóa đơn cho hợp đồng đã bị hủy.',
      });
    }
    if (
      msg.includes('CONTRACT_IMMUTABLE_AFTER_ACTIVATION') ||
      code === 'P6010'
    ) {
      throw new BadRequestException({
        code: 'CONTRACT_IMMUTABLE_AFTER_ACTIVATION',
        message:
          'Không thể sửa đổi thông tin tài chính của hợp đồng sau khi đã kích hoạt.',
      });
    }
    if (msg.includes('INVOICE_IMMUTABLE_AFTER_ISSUE') || code === 'P6012') {
      throw new BadRequestException({
        code: 'INVOICE_IMMUTABLE_AFTER_ISSUE',
        message:
          'Không thể sửa đổi thông tin tài chính của hóa đơn sau khi đã phát hành.',
      });
    }
    if (msg.includes('CONTRACT_NOT_FOUND') || code === 'P6004') {
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: 'Không tìm thấy hợp đồng yêu cầu.',
      });
    }
    if (msg.includes('INVOICE_NOT_FOUND') || code === 'P6020') {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Không tìm thấy hóa đơn yêu cầu.',
      });
    }
    if (
      msg.includes('CONTRACT_STATUS_TRANSITION_INVALID') ||
      code === 'P6011'
    ) {
      throw new BadRequestException({
        code: 'CONTRACT_STATUS_TRANSITION_INVALID',
        message: 'Chuyển trạng thái hợp đồng không hợp lệ.',
      });
    }
    if (msg.includes('INVOICE_STATUS_TRANSITION_INVALID') || code === 'P6014') {
      throw new BadRequestException({
        code: 'INVOICE_STATUS_TRANSITION_INVALID',
        message: 'Chuyển trạng thái hóa đơn không hợp lệ.',
      });
    }
    if (msg.includes('INVOICE_NOT_DUE') || code === 'P6015') {
      throw new BadRequestException({
        code: 'INVOICE_NOT_DUE',
        message:
          'Hóa đơn chưa đến hạn thanh toán để chuyển trạng thái quá hạn.',
      });
    }
    if (msg.includes('PAYMENT_AMOUNT_INVALID') || code === 'P6021') {
      throw new BadRequestException({
        code: 'PAYMENT_AMOUNT_INVALID',
        message: 'Số tiền thanh toán phải lớn hơn 0.',
      });
    }
    if (msg.includes('INVOICE_NOT_PAYABLE') || code === 'P6022') {
      throw new BadRequestException({
        code: 'INVOICE_NOT_PAYABLE',
        message: 'Hóa đơn không ở trạng thái có thể thanh toán.',
      });
    }
    if (msg.includes('PAYMENT_EXCEEDS_OUTSTANDING') || code === 'P6023') {
      throw new BadRequestException({
        code: 'PAYMENT_EXCEEDS_OUTSTANDING',
        message: 'Số tiền thanh toán vượt quá số dư còn lại của hóa đơn.',
      });
    }
    if (msg.includes('INVOICE_PAYMENT_STATE_INVALID') || code === 'P6016') {
      throw new BadRequestException({
        code: 'INVOICE_PAYMENT_STATE_INVALID',
        message: 'Trạng thái hóa đơn không hợp lệ để thực hiện thanh toán.',
      });
    }

    // Sanitize any other database error to client
    throw new InternalServerErrorException({
      code: 'FINANCE_DATABASE_ERROR',
      message: 'Không thể xử lý yêu cầu tài chính. Vui lòng thử lại.',
    });
  }

  private mapClientContract(c: any) {
    return {
      id: c.id,
      contract_number: c.contract_number,
      client_company_id: c.client_company_id,
      project_id: c.project_id,
      title: c.title,
      start_date: c.start_date,
      end_date: c.end_date,
      contract_value: c.contract_value,
      currency_code: c.currency_code,
      status: c.status,
      client_visible: c.client_visible,
      completed_at: c.completed_at,
      cancelled_at: c.cancelled_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
      client_company: c.client_company ? { name: c.client_company.name } : null,
      project: c.project ? { name: c.project.name } : null,
    };
  }

  private mapClientInvoice(i: any) {
    return {
      id: i.id,
      invoice_number: i.invoice_number,
      client_company_id: i.client_company_id,
      project_id: i.project_id,
      contract_id: i.contract_id,
      issue_date: i.issue_date,
      due_date: i.due_date,
      amount: i.amount,
      paid_amount: i.paid_amount,
      currency_code: i.currency_code,
      status: i.status,
      paid_at: i.paid_at,
      cancelled_at: i.cancelled_at,
      client_visible: i.client_visible,
      created_at: i.created_at,
      updated_at: i.updated_at,
      client_company: i.client_company ? { name: i.client_company.name } : null,
      project: i.project ? { name: i.project.name } : null,
      contract: i.contract
        ? { contract_number: i.contract.contract_number }
        : null,
    };
  }

  async getSummary(user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client.rpc('phase6_finance_summary');
    if (error) {
      this.handleDbError(error);
    }
    return data;
  }

  async getContracts(query: FinanceQuery, user: RequestUser) {
    this.enforceAuthorizedRoles(user);

    let dbQuery = this.client
      .from('contracts')
      .select(
        '*, client_company:client_companies(name), project:projects(name)',
        {
          count: 'exact',
        },
      );

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      if (companyIds.length === 0) {
        return {
          items: [],
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 0,
        };
      }
      dbQuery = dbQuery
        .in('client_company_id', companyIds)
        .eq('client_visible', true)
        .neq('status', 'draft');
    } else {
      if (query.clientCompanyId) {
        dbQuery = dbQuery.eq('client_company_id', query.clientCompanyId);
      }
    }

    if (query.projectId) {
      dbQuery = dbQuery.eq('project_id', query.projectId);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.query) {
      const q = query.query
        .trim()
        .slice(0, 100)
        .replace(/[(),%]/g, '');
      if (q.length > 0) {
        dbQuery = dbQuery.or(`contract_number.ilike.%${q}%,title.ilike.%${q}%`);
      }
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.handleDbError(error);
    }

    const rawItems = data || [];
    const items =
      user.role === 'client'
        ? rawItems.map((c) => this.mapClientContract(c))
        : rawItems;

    const total = count || 0;
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getContractById(id: string, user: RequestUser) {
    this.enforceAuthorizedRoles(user);

    let dbQuery = this.client
      .from('contracts')
      .select(
        '*, client_company:client_companies(name), project:projects(name)',
      )
      .eq('id', id);

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      dbQuery = dbQuery
        .in('client_company_id', companyIds)
        .eq('client_visible', true)
        .neq('status', 'draft');
    }

    const { data, error } = await dbQuery.maybeSingle();

    if (error) {
      this.handleDbError(error);
    }

    if (!data) {
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: 'Không tìm thấy hợp đồng yêu cầu hoặc không có quyền xem.',
      });
    }

    if (user.role === 'client') {
      return this.mapClientContract(data);
    }

    return data;
  }

  async createContract(dto: ContractCreateDto, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client
      .from('contracts')
      .insert({
        contract_number: dto.contractNumber.trim(),
        client_company_id: dto.clientCompanyId,
        project_id: dto.projectId || null,
        title: dto.title.trim(),
        start_date: dto.startDate,
        end_date: dto.endDate || null,
        contract_value: dto.contractValue,
        currency_code: dto.currencyCode.toUpperCase(),
        notes: dto.notes?.trim() || null,
        client_visible: dto.clientVisible,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select()
      .single();

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async updateContract(id: string, dto: ContractUpdateDto, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data: contract, error: getErr } = await this.client
      .from('contracts')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (getErr || !contract) {
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: 'Không tìm thấy hợp đồng yêu cầu.',
      });
    }

    if (contract.status !== 'draft') {
      const coreFields = [
        'contractNumber',
        'clientCompanyId',
        'projectId',
        'title',
        'startDate',
        'endDate',
        'contractValue',
        'currencyCode',
      ];
      const hasCoreEdits = Object.keys(dto).some((key) =>
        coreFields.includes(key),
      );
      if (hasCoreEdits) {
        throw new BadRequestException({
          code: 'CONTRACT_IMMUTABLE_AFTER_ACTIVATION',
          message:
            'Không thể sửa đổi thông tin tài chính của hợp đồng sau khi đã kích hoạt.',
        });
      }
    }

    const payload: any = {
      updated_by: user.profileId,
    };

    if (dto.contractNumber !== undefined)
      payload.contract_number = dto.contractNumber.trim();
    if (dto.clientCompanyId !== undefined)
      payload.client_company_id = dto.clientCompanyId;
    if (dto.projectId !== undefined) payload.project_id = dto.projectId || null;
    if (dto.title !== undefined) payload.title = dto.title.trim();
    if (dto.startDate !== undefined) payload.start_date = dto.startDate;
    if (dto.endDate !== undefined) payload.end_date = dto.endDate || null;
    if (dto.contractValue !== undefined)
      payload.contract_value = dto.contractValue;
    if (dto.currencyCode !== undefined)
      payload.currency_code = dto.currencyCode.toUpperCase();
    if (dto.notes !== undefined) payload.notes = dto.notes?.trim() || null;
    if (dto.clientVisible !== undefined)
      payload.client_visible = dto.clientVisible;

    const { data, error } = await this.client
      .from('contracts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async transitionContract(id: string, status: string, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client.rpc(
      'phase6_transition_contract',
      {
        p_contract_id: id,
        p_status: status,
        p_actor_user_id: user.profileId,
      },
    );

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async getInvoices(query: FinanceQuery, user: RequestUser) {
    this.enforceAuthorizedRoles(user);

    let dbQuery = this.client
      .from('invoices')
      .select(
        '*, client_company:client_companies(name), project:projects(name), contract:contracts(contract_number)',
        {
          count: 'exact',
        },
      );

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      if (companyIds.length === 0) {
        return {
          items: [],
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 0,
        };
      }
      dbQuery = dbQuery
        .in('client_company_id', companyIds)
        .eq('client_visible', true)
        .neq('status', 'draft');
    } else {
      if (query.clientCompanyId) {
        dbQuery = dbQuery.eq('client_company_id', query.clientCompanyId);
      }
    }

    if (query.projectId) {
      dbQuery = dbQuery.eq('project_id', query.projectId);
    }
    if (query.contractId) {
      dbQuery = dbQuery.eq('contract_id', query.contractId);
    }
    if (query.status) {
      if (query.status === 'overdue') {
        dbQuery = dbQuery
          .in('status', ['overdue', 'issued', 'partially_paid'])
          .lt('due_date', this.getVietnamDateOnly());
      } else {
        dbQuery = dbQuery.eq('status', query.status);
      }
    }
    if (query.query) {
      const q = query.query
        .trim()
        .slice(0, 100)
        .replace(/[(),%]/g, '');
      if (q.length > 0) {
        dbQuery = dbQuery.or(`invoice_number.ilike.%${q}%`);
      }
    }

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.handleDbError(error);
    }

    const rawItems = data || [];
    const items =
      user.role === 'client'
        ? rawItems.map((i) => this.mapClientInvoice(i))
        : rawItems;

    const total = count || 0;
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getInvoiceById(id: string, user: RequestUser) {
    this.enforceAuthorizedRoles(user);

    let dbQuery = this.client
      .from('invoices')
      .select(
        '*, client_company:client_companies(name), project:projects(name), contract:contracts(contract_number)',
      )
      .eq('id', id);

    if (user.role === 'client') {
      const companyIds = await this.getClientCompanyIds(user.profileId);
      dbQuery = dbQuery
        .in('client_company_id', companyIds)
        .eq('client_visible', true)
        .neq('status', 'draft');
    }

    const { data, error } = await dbQuery.maybeSingle();

    if (error) {
      this.handleDbError(error);
    }

    if (!data) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Không tìm thấy hóa đơn yêu cầu hoặc không có quyền xem.',
      });
    }

    if (user.role === 'client') {
      return this.mapClientInvoice(data);
    }

    return data;
  }

  async createInvoice(dto: InvoiceCreateDto, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client
      .from('invoices')
      .insert({
        invoice_number: dto.invoiceNumber.trim(),
        client_company_id: dto.clientCompanyId,
        project_id: dto.projectId || null,
        contract_id: dto.contractId || null,
        issue_date: dto.issueDate,
        due_date: dto.dueDate,
        amount: dto.amount,
        currency_code: dto.currencyCode.toUpperCase(),
        notes: dto.notes?.trim() || null,
        client_visible: dto.clientVisible,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select()
      .single();

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async updateInvoice(id: string, dto: InvoiceUpdateDto, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data: invoice, error: getErr } = await this.client
      .from('invoices')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (getErr || !invoice) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Không tìm thấy hóa đơn yêu cầu.',
      });
    }

    if (invoice.status !== 'draft') {
      const coreFields = [
        'invoiceNumber',
        'clientCompanyId',
        'projectId',
        'contractId',
        'issueDate',
        'dueDate',
        'amount',
        'currencyCode',
      ];
      const hasCoreEdits = Object.keys(dto).some((key) =>
        coreFields.includes(key),
      );
      if (hasCoreEdits) {
        throw new BadRequestException({
          code: 'INVOICE_IMMUTABLE_AFTER_ISSUE',
          message:
            'Không thể sửa đổi thông tin tài chính của hóa đơn sau khi đã phát hành.',
        });
      }
    }

    const payload: any = {
      updated_by: user.profileId,
    };

    if (dto.invoiceNumber !== undefined)
      payload.invoice_number = dto.invoiceNumber.trim();
    if (dto.clientCompanyId !== undefined)
      payload.client_company_id = dto.clientCompanyId;
    if (dto.projectId !== undefined) payload.project_id = dto.projectId || null;
    if (dto.contractId !== undefined)
      payload.contract_id = dto.contractId || null;
    if (dto.issueDate !== undefined) payload.issue_date = dto.issueDate;
    if (dto.dueDate !== undefined) payload.due_date = dto.dueDate;
    if (dto.amount !== undefined) payload.amount = dto.amount;
    if (dto.currencyCode !== undefined)
      payload.currency_code = dto.currencyCode.toUpperCase();
    if (dto.notes !== undefined) payload.notes = dto.notes?.trim() || null;
    if (dto.clientVisible !== undefined)
      payload.client_visible = dto.clientVisible;

    const { data, error } = await this.client
      .from('invoices')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async transitionInvoice(id: string, status: string, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client.rpc('phase6_transition_invoice', {
      p_invoice_id: id,
      p_status: status,
      p_actor_user_id: user.profileId,
    });

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async recordPayment(
    invoiceId: string,
    dto: PaymentRecordDto,
    user: RequestUser,
  ) {
    this.enforceAdminOrAccountant(user);

    const { data, error } = await this.client.rpc(
      'phase6_record_invoice_payment',
      {
        p_invoice_id: invoiceId,
        p_amount: dto.amount,
        p_paid_at: dto.paidAt,
        p_payment_reference: dto.paymentReference || '',
        p_payment_method: dto.paymentMethod || '',
        p_notes: dto.notes || '',
        p_actor_user_id: user.profileId,
      },
    );

    if (error) {
      this.handleDbError(error);
    }

    return data;
  }

  async getPayments(invoiceId: string, user: RequestUser) {
    this.enforceAuthorizedRoles(user);

    // Verify invoice visibility first
    await this.getInvoiceById(invoiceId, user);

    const dbQuery = this.client
      .from('invoice_payments')
      .select('*, profile:profiles(full_name)')
      .eq('invoice_id', invoiceId);

    const { data, error } = await dbQuery.order('paid_at', {
      ascending: false,
    });

    if (error) {
      this.handleDbError(error);
    }

    return (data || []).map((p) => {
      if (user.role === 'client') {
        return {
          id: p.id,
          invoiceId: p.invoice_id,
          amount: p.amount,
          paidAt: p.paid_at,
          createdAt: p.created_at,
        };
      }

      const cleanPayment: any = {
        id: p.id,
        invoiceId: p.invoice_id,
        amount: p.amount,
        paidAt: p.paid_at,
        paymentReference: p.payment_reference,
        paymentMethod: p.payment_method,
        notes: p.notes,
        createdAt: p.created_at,
      };

      const prof: any = p.profile;
      cleanPayment.recordedBy = prof?.full_name || null;

      return cleanPayment;
    });
  }

  async getAuditLogs(query: FinanceQuery, user: RequestUser) {
    this.enforceAdminOrAccountant(user);

    const dbQuery = this.client
      .from('finance_audit_events')
      .select('*, actor:profiles(full_name, email)', { count: 'exact' });

    const offset = (query.page - 1) * query.pageSize;
    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.handleDbError(error);
    }

    const total = count || 0;
    return {
      items: data || [],
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getMetaClients(query: FinanceQuery, user: RequestUser) {
    this.enforceAdminOrAccountant(user);
    const limit = Math.min(query.pageSize || 100, 100);
    const offset = ((query.page || 1) - 1) * limit;

    let dbQuery = this.client
      .from('client_companies')
      .select('id, code, name, status', { count: 'exact' });

    if (query.query) {
      const q = query.query
        .trim()
        .slice(0, 100)
        .replace(/[(),%]/g, '');
      if (q.length > 0) {
        dbQuery = dbQuery.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await dbQuery
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      this.handleDbError(error);
    }

    return {
      items: data || [],
      page: query.page || 1,
      pageSize: limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getMetaProjects(query: FinanceQuery, user: RequestUser) {
    this.enforceAdminOrAccountant(user);
    const limit = Math.min(query.pageSize || 100, 100);
    const offset = ((query.page || 1) - 1) * limit;

    let dbQuery = this.client
      .from('projects')
      .select('id, project_code, client_company_id, name, status', {
        count: 'exact',
      });

    if (query.clientCompanyId) {
      dbQuery = dbQuery.eq('client_company_id', query.clientCompanyId);
    }

    if (query.query) {
      const q = query.query
        .trim()
        .slice(0, 100)
        .replace(/[(),%]/g, '');
      if (q.length > 0) {
        dbQuery = dbQuery.or(`name.ilike.%${q}%,project_code.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await dbQuery
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      this.handleDbError(error);
    }

    return {
      items: data || [],
      page: query.page || 1,
      pageSize: limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getMetaContracts(query: FinanceQuery, user: RequestUser) {
    this.enforceAdminOrAccountant(user);
    const limit = Math.min(query.pageSize || 100, 100);
    const offset = ((query.page || 1) - 1) * limit;

    let dbQuery = this.client
      .from('contracts')
      .select(
        'id, contract_number, client_company_id, project_id, currency_code, status, title',
        { count: 'exact' },
      );

    if (query.clientCompanyId) {
      dbQuery = dbQuery.eq('client_company_id', query.clientCompanyId);
    }
    if (query.projectId) {
      dbQuery = dbQuery.eq('project_id', query.projectId);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    if (query.query) {
      const q = query.query
        .trim()
        .slice(0, 100)
        .replace(/[(),%]/g, '');
      if (q.length > 0) {
        dbQuery = dbQuery.or(`title.ilike.%${q}%,contract_number.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await dbQuery
      .order('contract_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      this.handleDbError(error);
    }

    return {
      items: data || [],
      page: query.page || 1,
      pageSize: limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }
}
