import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { GeneratePayrollRunDto, PayrollRunQuery } from './dto/payroll.dto';

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
        '*, approved_by:profiles!payroll_runs_approved_by_user_id_fkey(id, full_name, email, user_code)',
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
        '*, approved_by:profiles!payroll_runs_approved_by_user_id_fkey(id, full_name, email, user_code)',
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
        '*, user:profiles!payslips_user_id_fkey(id, full_name, email, user_code, avatar_url), employee_profile:employee_profiles(job_title, department_id)',
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

    // Check existing run
    const { data: existingRun } = await this.client
      .from('payroll_runs')
      .select('id, status')
      .eq('period_month', dto.periodMonth)
      .maybeSingle();

    if (existingRun && existingRun.status !== 'draft') {
      throw new ForbiddenException({
        code: 'PAYROLL_ALREADY_LOCKED',
        message: `Đợt lương tháng ${dto.periodMonth} đã được phê duyệt hoặc chi trả, không thể tính lại.`,
      });
    }

    let runId = existingRun?.id;
    if (!runId) {
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

      if (createErr || !newRun) {
        this.handleDbError(createErr, 'Không thể tạo đợt tính lương.');
      }
      runId = newRun.id;
    } else {
      // Delete existing payslips for recalculation
      await this.client.from('payslips').delete().eq('payroll_run_id', runId);
    }

    // Query all active employee profiles
    const { data: employees, error: empErr } = await this.client
      .from('employee_profiles')
      .select('id, user_id, base_salary, allowances')
      .eq('employment_status', 'active');

    if (empErr) {
      this.handleDbError(empErr, 'Không thể truy vấn danh sách nhân sự.');
    }

    const payslipInserts = [];
    let totalGross = 0;
    let totalNet = 0;

    for (const emp of employees || []) {
      const baseSalary = Number(emp.base_salary) || 10000000;
      const allowances = Number(emp.allowances) || 1000000;
      const standardDays = dto.standardWorkingDays || 22;

      // Query actual attendance days in this month
      const { data: attendances } = await this.client
        .from('attendance_records')
        .select('id, work_date, status')
        .eq('user_id', emp.user_id)
        .gte('work_date', startDate)
        .lte('work_date', endDate);

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
        employee_profile_id: emp.id,
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

    const { data, error } = await this.client
      .from('payroll_runs')
      .update({
        status: 'approved',
        approved_by_user_id: user.profileId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
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

    // Update all payslips to paid
    await this.client
      .from('payslips')
      .update({ payment_status: 'paid' })
      .eq('payroll_run_id', id);

    const { data, error } = await this.client
      .from('payroll_runs')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
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
