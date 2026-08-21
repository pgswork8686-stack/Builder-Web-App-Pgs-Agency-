import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import {
  GeneratePayrollRunDto,
  PayrollRunQuery,
  UpsertEmployeeCompensationDto,
} from './dto/payroll.dto';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private handleDbError(error: any, message: string): never {
    this.logger.error(`${message}: ${error?.message ?? JSON.stringify(error)}`);
    throw new InternalServerErrorException({
      code: 'PAYROLL_DATABASE_ERROR',
      message,
    });
  }

  async listPayrollRuns(query: PayrollRunQuery, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền xem danh sách đợt lương.',
      });
    }

    let dbQuery = this.client
      .from('payroll_runs')
      .select(
        '*, approved_by:profiles!payroll_runs_approved_by_user_id_fkey(id, full_name, email, account_code)',
        { count: 'exact' },
      );

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.year) {
      dbQuery = dbQuery.ilike('period_month', `${query.year}-%`);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    dbQuery = dbQuery
      .order('period_month', { ascending: false })
      .range(from, to);

    const { data, error, count } = await dbQuery;
    if (error) {
      this.handleDbError(error, 'Không thể tải danh sách đợt lương.');
    }

    return {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async getPayrollRunById(id: string, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền xem chi tiết đợt lương.',
      });
    }

    const { data: run, error: runErr } = await this.client
      .from('payroll_runs')
      .select(
        '*, approved_by:profiles!payroll_runs_approved_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('id', id)
      .maybeSingle();

    if (runErr || !run) {
      throw new NotFoundException({
        code: 'PAYROLL_RUN_NOT_FOUND',
        message: 'Không tìm thấy đợt lương.',
      });
    }

    const { data: payslips, error: slipsErr } = await this.client
      .from('payslips')
      .select(
        '*, user:profiles!payslips_user_id_fkey(id, full_name, email, account_code, avatar_url), employee_profile:employee_profiles(job_title, department_id)',
      )
      .eq('payroll_run_id', id)
      .order('created_at', { ascending: true });

    if (slipsErr) {
      this.handleDbError(slipsErr, 'Không thể tải danh sách phiếu lương.');
    }

    return {
      ...run,
      payslips: payslips || [],
    };
  }

  async listEmployeeCompensations(user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message:
          'Chỉ Admin hoặc Kế toán mới có quyền xem cấu hình lương nhân sự.',
      });
    }

    const { data, error } = await this.client
      .from('employee_profiles')
      .select(
        'user_id, employee_code, job_title, employment_status, profile:profiles!employee_profiles_user_id_fkey(id, full_name, email, account_code), compensation:employee_compensation_settings(base_salary, allowances, updated_at, updated_by_user_id, updated_by:profiles!employee_compensation_settings_updated_by_user_id_fkey(id, full_name, email, account_code))',
      )
      .eq('employment_status', 'active')
      .order('employee_code', { ascending: true });

    if (error) {
      this.handleDbError(error, 'Không thể tải cấu hình lương nhân sự.');
    }

    return {
      items: (data || []).map((employee: any) => {
        const compensation = Array.isArray(employee.compensation)
          ? employee.compensation[0]
          : employee.compensation;

        return {
          userId: employee.user_id,
          employeeCode: employee.employee_code,
          fullName: employee.profile?.full_name ?? null,
          email: employee.profile?.email ?? null,
          accountCode: employee.profile?.account_code ?? null,
          jobTitle: employee.job_title ?? null,
          employmentStatus: employee.employment_status,
          baseSalary: compensation ? Number(compensation.base_salary) : null,
          allowances: compensation ? Number(compensation.allowances) : null,
          updatedAt: compensation?.updated_at ?? null,
          updatedBy: compensation?.updated_by
            ? {
                id: compensation.updated_by.id,
                fullName: compensation.updated_by.full_name ?? null,
                email: compensation.updated_by.email ?? null,
                accountCode: compensation.updated_by.account_code ?? null,
              }
            : null,
        };
      }),
    };
  }

  async upsertEmployeeCompensation(
    employeeUserId: string,
    dto: UpsertEmployeeCompensationDto,
    user: RequestUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message:
          'Chỉ Admin hoặc Kế toán mới có quyền cập nhật cấu hình lương nhân sự.',
      });
    }

    const { data: employee, error: employeeError } = await this.client
      .from('employee_profiles')
      .select('user_id, employment_status')
      .eq('user_id', employeeUserId)
      .maybeSingle();

    if (employeeError) {
      this.handleDbError(
        employeeError,
        'Không thể kiểm tra hồ sơ nhân sự trước khi cập nhật cấu hình lương.',
      );
    }

    if (!employee) {
      throw new NotFoundException({
        code: 'PAYROLL_EMPLOYEE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ nhân sự để cấu hình lương.',
      });
    }

    if (employee.employment_status !== 'active') {
      throw new BadRequestException({
        code: 'PAYROLL_EMPLOYEE_NOT_ACTIVE',
        message:
          'Chỉ có thể cấu hình lương cho nhân sự đang ở trạng thái hoạt động.',
      });
    }

    const { data, error } = await this.client
      .from('employee_compensation_settings')
      .upsert(
        {
          user_id: employeeUserId,
          base_salary: dto.baseSalary,
          allowances: dto.allowances,
          updated_by_user_id: user.profileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể lưu cấu hình lương nhân sự.');
    }

    return data;
  }

  async generatePayrollRun(dto: GeneratePayrollRunDto, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message:
          'Chỉ Admin hoặc Kế toán mới có quyền tạo và tính toán đợt lương.',
      });
    }

    const [yearStr, monthStr] = dto.periodMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = `${dto.periodMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${dto.periodMonth}-${String(lastDay).padStart(2, '0')}`;

    // Check existing run for the exact period
    const { data: existingRun, error: existingRunError } = await this.client
      .from('payroll_runs')
      .select('id, status')
      .eq('period_month', dto.periodMonth)
      .maybeSingle();

    if (existingRunError) {
      this.handleDbError(
        existingRunError,
        'Không thể kiểm tra đợt lương hiện có.',
      );
    }

    if (existingRun) {
      throw new ConflictException({
        code: 'PAYROLL_RUN_DUPLICATE_PERIOD',
        message: `Đợt lương tháng ${dto.periodMonth} đã tồn tại trong hệ thống.`,
      });
    }

    // Query all active employee profiles
    const { data: employees, error: empErr } = await this.client
      .from('employee_profiles')
      .select('user_id, job_title')
      .eq('employment_status', 'active')
      .order('user_id', { ascending: true });

    if (empErr) {
      this.handleDbError(empErr, 'Không thể truy vấn danh sách nhân sự.');
    }

    const employeeIds = (employees || []).map((employee: any) =>
      String(employee.user_id),
    );
    const compensationByEmployeeId = new Map<
      string,
      { baseSalary: number; allowances: number }
    >();

    if (employeeIds.length > 0) {
      const { data: compensations, error: compensationErr } = await this.client
        .from('employee_compensation_settings')
        .select('user_id, base_salary, allowances')
        .in('user_id', employeeIds);

      if (compensationErr) {
        this.handleDbError(
          compensationErr,
          'Không thể truy vấn cấu hình lương nhân sự.',
        );
      }

      for (const compensation of compensations || []) {
        const baseSalary = Number(compensation.base_salary);
        const allowances = Number(compensation.allowances);

        if (
          Number.isFinite(baseSalary) &&
          baseSalary > 0 &&
          Number.isFinite(allowances) &&
          allowances >= 0
        ) {
          compensationByEmployeeId.set(String(compensation.user_id), {
            baseSalary,
            allowances,
          });
        }
      }
    }

    const missingEmployeeIds = employeeIds.filter(
      (employeeId) => !compensationByEmployeeId.has(employeeId),
    );

    if (missingEmployeeIds.length > 0) {
      throw new UnprocessableEntityException({
        code: 'PAYROLL_COMPENSATION_MISSING',
        message: `Không thể tính lương tháng ${dto.periodMonth} vì ${missingEmployeeIds.length} nhân sự đang hoạt động chưa có cấu hình lương hợp lệ.`,
        missingEmployeeIds,
      });
    }

    // Insert new payroll run
    const { data: newRun, error: createErr } = await this.client
      .from('payroll_runs')
      .insert({
        period_month: dto.periodMonth,
        period_start_date: startDate,
        period_end_date: endDate,
        title: dto.title,
        status: 'calculated',
        created_by: user.profileId,
      })
      .select()
      .single();

    if (createErr) {
      if (
        createErr.code === '23505' ||
        createErr.message?.includes('uq_payroll_runs_period_month')
      ) {
        throw new ConflictException({
          code: 'PAYROLL_RUN_DUPLICATE_PERIOD',
          message: `Đợt lương tháng ${dto.periodMonth} đã tồn tại trong hệ thống.`,
        });
      }
      this.handleDbError(createErr, 'Không thể tạo đợt tính lương.');
    }

    if (!newRun || typeof newRun.id !== 'string') {
      throw new InternalServerErrorException({
        code: 'PAYROLL_RUN_CREATION_FAILED',
        message: 'Không thể tạo đợt tính lương.',
      });
    }

    const runId = newRun.id;

    const payslipInserts = [];
    let totalGross = 0;
    let totalNet = 0;

    for (const emp of employees || []) {
      const compensation = compensationByEmployeeId.get(String(emp.user_id));
      if (!compensation) {
        throw new InternalServerErrorException({
          code: 'PAYROLL_COMPENSATION_RESOLUTION_FAILED',
          message: 'Không thể áp dụng cấu hình lương đã được xác thực.',
        });
      }

      const { baseSalary, allowances } = compensation;
      const standardDays = dto.standardWorkingDays || 22;

      // Query actual attendance days in this month
      const { data: attendances } = await this.client
        .from('attendance_records')
        .select('id, attendance_date, status')
        .eq('user_id', emp.user_id)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      const actualWorkedDays = attendances ? attendances.length : standardDays;
      const paidLeaveDays = 0;
      const overtimePay = 0;
      const bonus = 0;
      const deductions = 0;

      const dailyRate = baseSalary / standardDays;
      const earnedBase = Math.round(
        dailyRate * Math.min(actualWorkedDays, standardDays),
      );
      const grossSalary = earnedBase + allowances + overtimePay + bonus;
      const netSalary = grossSalary - deductions;

      totalGross += grossSalary;
      totalNet += netSalary;

      payslipInserts.push({
        payroll_run_id: runId,
        user_id: emp.user_id,
        employee_profile_id: emp.user_id,
        standard_working_days: standardDays,
        actual_worked_days: actualWorkedDays,
        paid_leave_days: paidLeaveDays,
        unpaid_leave_days: 0,
        base_salary: baseSalary,
        allowances,
        overtime_pay: overtimePay,
        bonus,
        deductions,
        gross_salary: grossSalary,
        net_salary: netSalary,
        payment_status: 'unpaid',
      });
    }

    if (payslipInserts.length > 0) {
      const { error: insertErr } = await this.client
        .from('payslips')
        .insert(payslipInserts);

      if (insertErr) {
        // Rollback payroll run creation to avoid partial inconsistency
        await this.client.from('payroll_runs').delete().eq('id', runId);
        this.handleDbError(insertErr, 'Không thể lưu danh sách phiếu lương.');
      }
    }

    // Update totals in payroll run
    const { error: updateErr } = await this.client
      .from('payroll_runs')
      .update({
        status: 'calculated',
        total_gross_amount: totalGross,
        total_net_amount: totalNet,
        total_employees_count: payslipInserts.length,
      })
      .eq('id', runId);

    if (updateErr) {
      this.handleDbError(
        updateErr,
        'Không thể cập nhật tổng số liệu đợt lương.',
      );
    }

    return this.getPayrollRunById(runId, user);
  }

  async approvePayrollRun(id: string, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền duyệt đợt lương.',
      });
    }

    const { data, error } = await this.client.rpc('approve_payroll_run', {
      p_run_id: id,
      p_approved_by: user.profileId,
    });

    if (error) {
      if (
        error.code === 'P0002' ||
        error.message?.includes('PAYROLL_RUN_NOT_FOUND')
      ) {
        throw new NotFoundException({
          code: 'PAYROLL_RUN_NOT_FOUND',
          message: 'Không tìm thấy đợt lương.',
        });
      }
      if (error.message?.includes('PAYROLL_ALREADY_APPROVED')) {
        throw new BadRequestException({
          code: 'PAYROLL_ALREADY_APPROVED',
          message: 'Đợt lương đã được phê duyệt trước đó.',
        });
      }
      if (error.message?.includes('PAYROLL_ALREADY_PAID')) {
        throw new BadRequestException({
          code: 'PAYROLL_ALREADY_PAID',
          message: 'Đợt lương đã được chi trả, không thể duyệt lại.',
        });
      }
      if (error.message?.includes('PAYROLL_INVALID_STATE_TRANSITION')) {
        throw new BadRequestException({
          code: 'PAYROLL_INVALID_STATE_TRANSITION',
          message: 'Trạng thái đợt lương không hợp lệ để phê duyệt.',
        });
      }
      this.handleDbError(error, 'Không thể phê duyệt đợt lương.');
    }

    return data;
  }

  async markPayrollPaid(id: string, user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message:
          'Chỉ Admin hoặc Kế toán mới có quyền đánh dấu chi trả đợt lương.',
      });
    }

    const { data, error } = await this.client.rpc('mark_payroll_run_paid', {
      p_run_id: id,
    });

    if (error) {
      if (
        error.code === 'P0002' ||
        error.message?.includes('PAYROLL_RUN_NOT_FOUND')
      ) {
        throw new NotFoundException({
          code: 'PAYROLL_RUN_NOT_FOUND',
          message: 'Không tìm thấy đợt lương.',
        });
      }
      if (error.message?.includes('PAYROLL_ALREADY_PAID')) {
        throw new BadRequestException({
          code: 'PAYROLL_ALREADY_PAID',
          message: 'Đợt lương đã được chi trả trước đó.',
        });
      }
      if (error.message?.includes('PAYROLL_NOT_APPROVED')) {
        throw new BadRequestException({
          code: 'PAYROLL_NOT_APPROVED',
          message: 'Chỉ có thể chi trả đợt lương đã được phê duyệt.',
        });
      }
      this.handleDbError(error, 'Không thể hoàn tất chi trả đợt lương.');
    }

    return data;
  }

  async getMyPayslips(user: RequestUser) {
    const { data, error } = await this.client
      .from('payslips')
      .select(
        '*, payroll_run:payroll_runs(period_month, title, status, paid_at)',
      )
      .eq('user_id', user.profileId)
      .order('created_at', { ascending: false });

    if (error) {
      this.handleDbError(error, 'Không thể truy vấn phiếu lương cá nhân.');
    }

    return data || [];
  }
}
