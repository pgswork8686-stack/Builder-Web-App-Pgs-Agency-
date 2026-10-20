import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateExpenseDto,
  ExpenseQuery,
  ReviewExpenseDto,
} from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  /**
   * Always-on notifications for the expense loop (no automation rule needed):
   * a new request goes to the accountants, a decision / reimbursement to the
   * person who submitted it. Never fails the business write.
   */
  private async notifyExpense(
    kind: 'submitted' | 'approved' | 'rejected' | 'reimbursed',
    expense: Record<string, any>,
    actor: RequestUser,
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const label = `${expense.title} (${Number(expense.amount).toLocaleString('vi-VN')} ${expense.currency_code ?? 'VND'})`;
      const project = Array.isArray(expense.project)
        ? expense.project[0]
        : expense.project;
      const where = project?.project_code ? ` · ${project.project_code}` : '';
      const base = {
        entityType: 'project_expense',
        entityId: String(expense.id),
        metadata: { projectId: expense.project_id },
        actorUserId: actor.profileId,
      };
      if (kind === 'submitted') {
        const { data, error } = await this.client
          .from('profiles')
          .select('id')
          .eq('role', 'accountant')
          .eq('account_status', 'active')
          .limit(100);
        if (error) throw error;
        await this.notifications.createForUsers(
          (data ?? []).map((row) => String(row.id)),
          {
            ...base,
            type: 'expense.submitted',
            title: 'Có đề nghị chi phí mới',
            message: `Đề nghị chi phí ${label}${where} đang chờ bạn duyệt.`,
            actionUrl: '/app/accountant/finance/project-expenses',
          },
        );
        return;
      }
      const submitter = String(expense.submitted_by_user_id);
      const copy = {
        approved: {
          title: 'Đề nghị chi phí đã được duyệt',
          message: `Đề nghị chi phí ${label}${where} đã được duyệt.`,
        },
        rejected: {
          title: 'Đề nghị chi phí bị từ chối',
          message: `Đề nghị chi phí ${label}${where} bị từ chối.${expense.rejection_reason ? ` Lý do: ${expense.rejection_reason}` : ''}`,
        },
        reimbursed: {
          title: 'Chi phí đã được hoàn ứng',
          message: `Đề nghị chi phí ${label}${where} đã được hoàn ứng.`,
        },
      }[kind];
      await this.notifications.createForUsers([submitter], {
        ...base,
        type: `expense.${kind}`,
        ...copy,
        actionUrl: '/app/accountant/finance/project-expenses',
      });
    } catch (error) {
      this.logger.error(
        `Expense notification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private handleDbError(error: any, message: string): never {
    this.logger.error(`${message}: ${error?.message ?? JSON.stringify(error)}`);
    throw new InternalServerErrorException({
      code: 'EXPENSE_DATABASE_ERROR',
      message,
    });
  }

  /**
   * Expense access is deliberately based on the per-project membership, rather
   * than the user's global application role. A team leader must also be the
   * project's manager; an employee may submit only as a project member.
   */
  private async requireExpenseProjectMembership(
    projectId: string,
    user: RequestUser,
  ) {
    const { data: membership, error } = await this.client
      .from('project_memberships')
      .select('id, project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.profileId)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra quyền dự án.');
    }

    if (!membership) {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message:
          user.role === 'team_leader'
            ? 'Trưởng nhóm chỉ có quyền truy cập chi phí của dự án do mình quản lý.'
            : 'Bạn chỉ có quyền tạo đề nghị chi phí cho dự án mà mình là thành viên.',
      });
    }

    if (
      user.role === 'team_leader' &&
      membership.project_role !== 'project_manager'
    ) {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message:
          'Trưởng nhóm chỉ có quyền truy cập chi phí của dự án do mình quản lý.',
      });
    }
  }

  private async getManagedProjectIds(user: RequestUser): Promise<string[]> {
    const { data: memberships, error } = await this.client
      .from('project_memberships')
      .select('project_id')
      .eq('user_id', user.profileId)
      .eq('project_role', 'project_manager');

    if (error) {
      this.handleDbError(error, 'Không thể kiểm tra quyền dự án.');
    }

    return (memberships ?? []).map((membership) => membership.project_id);
  }

  async listExpenses(query: ExpenseQuery, user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập đề nghị chi phí.',
      });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const managedProjectIds =
      user.role === 'team_leader'
        ? await this.getManagedProjectIds(user)
        : undefined;

    if (managedProjectIds?.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    let dbQuery = this.client
      .from('project_expenses')
      .select(
        '*, project:projects(id, name, project_code), submitted_by:profiles!project_expenses_submitted_by_user_id_fkey(id, full_name, email, account_code), approved_by:profiles!project_expenses_approved_by_user_id_fkey(id, full_name, email, account_code)',
        { count: 'exact' },
      );

    // Employees can only see expenses they submitted.
    if (user.role === 'employee') {
      dbQuery = dbQuery.eq('submitted_by_user_id', user.profileId);
    }

    // A global team_leader role is not sufficient: list only projects that
    // explicitly designate this user as a project manager.
    if (managedProjectIds) {
      dbQuery = dbQuery.in('project_id', managedProjectIds);
    }

    if (query.projectId) {
      dbQuery = dbQuery.eq('project_id', query.projectId);
    }
    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.category) {
      dbQuery = dbQuery.eq('expense_category', query.category);
    }
    if (query.from) {
      dbQuery = dbQuery.gte('expense_date', query.from);
    }
    if (query.to) {
      dbQuery = dbQuery.lte('expense_date', query.to);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    dbQuery = dbQuery
      .order('expense_date', { ascending: false })
      .range(from, to);

    const { data, error, count } = await dbQuery;
    if (error) {
      this.handleDbError(error, 'Không thể tải danh sách chi phí.');
    }

    return {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async getExpenseById(id: string, user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập đề nghị chi phí.',
      });
    }

    const { data, error } = await this.client
      .from('project_expenses')
      .select(
        '*, project:projects(id, name, project_code), submitted_by:profiles!project_expenses_submitted_by_user_id_fkey(id, full_name, email, account_code), approved_by:profiles!project_expenses_approved_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể truy vấn đề nghị chi phí.');
    }
    if (!data) {
      throw new NotFoundException({
        code: 'EXPENSE_NOT_FOUND',
        message: 'Không tìm thấy đề nghị chi phí.',
      });
    }

    // Ownership check for employee
    if (
      user.role === 'employee' &&
      data.submitted_by_user_id !== user.profileId
    ) {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Bạn chỉ có quyền xem đề nghị chi phí do chính mình tạo.',
      });
    }

    if (user.role === 'team_leader') {
      await this.requireExpenseProjectMembership(data.project_id, user);
    }

    return data;
  }

  async createExpense(dto: CreateExpenseDto, user: RequestUser) {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Khách hàng không có quyền tạo đề nghị chi phí.',
      });
    }

    // Verify project exists
    const { data: project, error: projErr } = await this.client
      .from('projects')
      .select('id, project_code')
      .eq('id', dto.projectId)
      .maybeSingle();

    if (projErr || !project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Không tìm thấy dự án tương ứng.',
      });
    }

    if (user.role === 'employee' || user.role === 'team_leader') {
      await this.requireExpenseProjectMembership(dto.projectId, user);
    }

    const { data, error } = await this.client
      .from('project_expenses')
      .insert({
        project_id: dto.projectId,
        submitted_by_user_id: user.profileId,
        title: dto.title,
        amount: dto.amount,
        currency_code: dto.currencyCode || 'VND',
        expense_category: dto.expenseCategory,
        expense_date: dto.expenseDate || new Date().toISOString().split('T')[0],
        receipt_url: dto.receiptUrl || null,
        notes: dto.notes || null,
        status: 'pending',
      })
      .select(
        '*, project:projects(id, name, project_code), submitted_by:profiles!project_expenses_submitted_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể tạo đề nghị chi phí.');
    }

    await this.notifyExpense('submitted', data, user);
    return data;
  }

  async reviewExpense(id: string, dto: ReviewExpenseDto, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền duyệt/từ chối chi phí.',
      });
    }

    const existing = await this.getExpenseById(id, user);
    if (existing.status !== 'pending') {
      throw new ForbiddenException({
        code: 'EXPENSE_ALREADY_PROCESSED',
        message: 'Đề nghị chi phí này đã được xử lý trước đó.',
      });
    }

    if (
      dto.action === 'rejected' &&
      (dto.rejectionReason ?? '').trim().length < 5
    ) {
      throw new BadRequestException({
        code: 'EXPENSE_REJECTION_REASON_REQUIRED',
        message: 'Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự).',
      });
    }

    const updatePayload: Record<string, any> = {
      status: dto.action,
      approved_by_user_id: user.profileId,
      approved_at: new Date().toISOString(),
      rejection_reason: dto.action === 'rejected' ? dto.rejectionReason : null,
    };

    // Conditional on "still pending": two reviewers answering at the same time
    // cannot overwrite each other's decision.
    const { data, error } = await this.client
      .from('project_expenses')
      .update(updatePayload)
      .eq('id', id)
      .eq('status', 'pending')
      .select(
        '*, project:projects(id, name, project_code), submitted_by:profiles!project_expenses_submitted_by_user_id_fkey(id, full_name, email, account_code), approved_by:profiles!project_expenses_approved_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể cập nhật trạng thái chi phí.');
    }
    if (!data) {
      throw new ForbiddenException({
        code: 'EXPENSE_ALREADY_PROCESSED',
        message: 'Đề nghị chi phí này đã được xử lý trước đó.',
      });
    }

    await this.notifyExpense(dto.action, data, user);
    return data;
  }

  async reimburseExpense(id: string, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'EXPENSE_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền hoàn ứng chi phí.',
      });
    }

    const existing = await this.getExpenseById(id, user);
    if (existing.status !== 'approved') {
      throw new ForbiddenException({
        code: 'EXPENSE_NOT_APPROVED',
        message: 'Chỉ có thể giải ngân chi phí đã được phê duyệt.',
      });
    }

    // Conditional on "still approved": a double click or two accountants can
    // never reimburse the same expense twice.
    const { data, error } = await this.client
      .from('project_expenses')
      .update({ status: 'reimbursed' })
      .eq('id', id)
      .eq('status', 'approved')
      .select('*, project:projects(id, name, project_code)')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'Không thể giải ngân chi phí.');
    }
    if (!data) {
      throw new ForbiddenException({
        code: 'EXPENSE_NOT_APPROVED',
        message: 'Chỉ có thể giải ngân chi phí đã được phê duyệt.',
      });
    }

    await this.notifyExpense('reimbursed', data, user);
    return data;
  }
}
