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
  calculateAttendanceBonus,
  calculateAttendancePenalty,
} from './attendance-calculator';
import {
  CreateCompensationRevisionDto,
  GeneratePayrollRunDto,
  PayrollRunQuery,
  UpsertEmployeeCompensationDto,
  UpsertMonthlyPayrollReviewDto,
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

  private assertAdminOrAccountant(user: RequestUser) {
    if (user.role !== 'admin' && user.role !== 'accountant') {
      throw new ForbiddenException({
        code: 'PAYROLL_ACCESS_DENIED',
        message: 'Chỉ Admin hoặc Kế toán mới có quyền thực hiện thao tác này.',
      });
    }
  }

  async listPayrollRuns(query: PayrollRunQuery, user: RequestUser) {
    this.assertAdminOrAccountant(user);

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
    this.assertAdminOrAccountant(user);

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
    this.assertAdminOrAccountant(user);

    // Query active employees
    const { data: employees, error: empError } = await this.client
      .from('employee_profiles')
      .select(
        'user_id, employee_code, job_title, employment_status, joined_date, left_date, profile:profiles!employee_profiles_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('employment_status', 'active')
      .order('employee_code', { ascending: true });

    if (empError) {
      this.handleDbError(empError, 'Không thể tải danh sách nhân sự.');
    }

    const userIds = (employees || []).map((e: any) => e.user_id);

    // Query all compensation history records for active employees
    const { data: history, error: histError } = await this.client
      .from('employee_compensation_history')
      .select(
        'id, user_id, base_salary, allowances, effective_from, payroll_eligible, notes, updated_at, updated_by:profiles!employee_compensation_history_updated_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .in('user_id', userIds)
      .order('effective_from', { ascending: false });

    if (histError) {
      this.handleDbError(
        histError,
        'Không thể tải lịch sử cấu hình lương nhân sự.',
      );
    }

    const historyByUserId = new Map<string, any[]>();
    for (const h of history || []) {
      const list = historyByUserId.get(h.user_id) || [];
      list.push(h);
      historyByUserId.set(h.user_id, list);
    }

    const items = (employees || []).map((emp: any) => {
      const userHistory = historyByUserId.get(emp.user_id) || [];
      const latest = userHistory[0] || null;

      let status: 'configured' | 'missing' | 'not_eligible' = 'missing';
      if (latest) {
        status = latest.payroll_eligible ? 'configured' : 'not_eligible';
      }

      return {
        userId: emp.user_id,
        employeeCode: emp.employee_code,
        fullName: emp.profile?.full_name ?? null,
        email: emp.profile?.email ?? null,
        accountCode: emp.profile?.account_code ?? null,
        jobTitle: emp.job_title ?? null,
        employmentStatus: emp.employment_status,
        joinedDate: emp.joined_date ?? null,
        leftDate: emp.left_date ?? null,
        status,
        baseSalary: latest ? Number(latest.base_salary) : null,
        allowances: latest ? Number(latest.allowances) : null,
        effectiveFrom: latest?.effective_from ?? null,
        payrollEligible: latest?.payroll_eligible ?? true,
        notes: latest?.notes ?? null,
        historyCount: userHistory.length,
        updatedAt: latest?.updated_at ?? null,
        updatedBy: latest?.updated_by
          ? {
              id: latest.updated_by.id,
              fullName: latest.updated_by.full_name ?? null,
              email: latest.updated_by.email ?? null,
              accountCode: latest.updated_by.account_code ?? null,
            }
          : null,
      };
    });

    return { items };
  }

  async getEmployeeCompensationHistory(
    employeeUserId: string,
    user: RequestUser,
  ) {
    this.assertAdminOrAccountant(user);

    const { data, error } = await this.client
      .from('employee_compensation_history')
      .select(
        'id, user_id, base_salary, allowances, effective_from, payroll_eligible, notes, created_at, updated_at, updated_by:profiles!employee_compensation_history_updated_by_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('user_id', employeeUserId)
      .order('effective_from', { ascending: false });

    if (error) {
      this.handleDbError(error, 'Không thể tải lịch sử lương nhân sự.');
    }

    return {
      userId: employeeUserId,
      history: (data || []).map((h: any) => ({
        id: h.id,
        baseSalary: Number(h.base_salary),
        allowances: Number(h.allowances),
        effectiveFrom: h.effective_from,
        payrollEligible: h.payroll_eligible,
        notes: h.notes,
        createdAt: h.created_at,
        updatedAt: h.updated_at,
        updatedBy: h.updated_by
          ? {
              id: h.updated_by.id,
              fullName: h.updated_by.full_name ?? null,
              email: h.updated_by.email ?? null,
              accountCode: h.updated_by.account_code ?? null,
            }
          : null,
      })),
    };
  }

  async createEmployeeCompensationRevision(
    employeeUserId: string,
    dto: CreateCompensationRevisionDto,
    user: RequestUser,
  ) {
    this.assertAdminOrAccountant(user);

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
      .from('employee_compensation_history')
      .upsert(
        {
          user_id: employeeUserId,
          base_salary: dto.baseSalary,
          allowances: dto.allowances ?? 0,
          effective_from: dto.effectiveFrom,
          payroll_eligible: dto.payrollEligible ?? true,
          notes: dto.notes ?? null,
          created_by_user_id: user.profileId,
          updated_by_user_id: user.profileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,effective_from' },
      )
      .select()
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể lưu phiên bản lương nhân sự.');
    }

    // Sync to legacy table for backwards compatibility
    await this.client.from('employee_compensation_settings').upsert(
      {
        user_id: employeeUserId,
        base_salary: dto.baseSalary,
        allowances: dto.allowances ?? 0,
        updated_by_user_id: user.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return data;
  }

  async upsertEmployeeCompensation(
    employeeUserId: string,
    dto: UpsertEmployeeCompensationDto,
    user: RequestUser,
  ) {
    const effectiveFrom = dto.effectiveFrom || '2026-01-01';
    return this.createEmployeeCompensationRevision(
      employeeUserId,
      {
        baseSalary: dto.baseSalary,
        allowances: dto.allowances ?? 0,
        effectiveFrom,
        payrollEligible: dto.payrollEligible ?? true,
        notes: dto.notes ?? null,
      },
      user,
    );
  }

  async listMonthlyPayrollReviews(periodMonth: string, user: RequestUser) {
    this.assertAdminOrAccountant(user);

    const { data, error } = await this.client
      .from('employee_monthly_payroll_reviews')
      .select(
        '*, user:profiles!employee_monthly_payroll_reviews_user_id_fkey(id, full_name, email, account_code)',
      )
      .eq('period_month', periodMonth);

    if (error) {
      this.handleDbError(
        error,
        'Không thể tải danh sách đánh giá tuân thủ tháng.',
      );
    }

    return { items: data || [] };
  }

  async upsertMonthlyPayrollReview(
    employeeUserId: string,
    periodMonth: string,
    dto: UpsertMonthlyPayrollReviewDto,
    user: RequestUser,
  ) {
    this.assertAdminOrAccountant(user);

    const { data, error } = await this.client
      .from('employee_monthly_payroll_reviews')
      .upsert(
        {
          user_id: employeeUserId,
          period_month: periodMonth,
          discipline_bonus_eligible: dto.disciplineBonusEligible,
          early_leave_makeup_confirmed: dto.earlyLeaveMakeupConfirmed,
          notes: dto.notes ?? null,
          updated_by_user_id: user.profileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,period_month' },
      )
      .select()
      .single();

    if (error) {
      this.handleDbError(error, 'Không thể cập nhật đánh giá tuân thủ tháng.');
    }

    return data;
  }

  async generatePayrollRun(dto: GeneratePayrollRunDto, user: RequestUser) {
    this.assertAdminOrAccountant(user);

    const [yearStr, monthStr] = dto.periodMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const startDate = `${dto.periodMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${dto.periodMonth}-${String(lastDay).padStart(2, '0')}`;

    // 1. Check existing run for the exact period
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

    // 2. Fetch standard working days from Work Calendar RPC
    const { data: calendarDays, error: calendarError } = await this.client.rpc(
      'get_company_work_calendar',
      {
        p_from: startDate,
        p_to: endDate,
      },
    );

    if (calendarError || !calendarDays) {
      this.logger.error(
        `Failed to resolve work calendar for ${startDate}..${endDate}: ${calendarError?.message}`,
      );
      throw new InternalServerErrorException({
        code: 'PAYROLL_CALENDAR_RESOLUTION_FAILED',
        message:
          'Không thể tính toán ngày công chuẩn từ lịch làm việc công ty.',
      });
    }

    const companyWorkDays = (calendarDays || []).filter(
      (d: any) => d.is_working_day === true,
    );
    const companyStandardDays =
      companyWorkDays.length > 0 ? companyWorkDays.length : 22;

    // 3. Query all active employee profiles
    const { data: employees, error: empErr } = await this.client
      .from('employee_profiles')
      .select('user_id, job_title, joined_date, left_date')
      .eq('employment_status', 'active')
      .order('user_id', { ascending: true });

    if (empErr) {
      this.handleDbError(empErr, 'Không thể truy vấn danh sách nhân sự.');
    }

    const employeeList = employees || [];
    const employeeIds = employeeList.map((emp: any) => String(emp.user_id));

    // 4. Query compensation history for all active employees effective for this month
    const compensationByEmployeeId = new Map<
      string,
      { baseSalary: number; allowances: number; payrollEligible: boolean }
    >();

    if (employeeIds.length > 0) {
      const { data: historyRecords, error: historyErr } = await this.client
        .from('employee_compensation_history')
        .select(
          'user_id, base_salary, allowances, effective_from, payroll_eligible',
        )
        .in('user_id', employeeIds)
        .lte('effective_from', startDate)
        .order('effective_from', { ascending: false });

      if (historyErr) {
        this.handleDbError(
          historyErr,
          'Không thể truy vấn cấu hình lương nhân sự.',
        );
      }

      for (const record of historyRecords || []) {
        const userIdStr = String(record.user_id);
        if (!compensationByEmployeeId.has(userIdStr)) {
          const baseSalary = Number(record.base_salary);
          const allowances = Number(record.allowances);

          if (
            Number.isFinite(baseSalary) &&
            baseSalary > 0 &&
            Number.isFinite(allowances) &&
            allowances >= 0
          ) {
            compensationByEmployeeId.set(userIdStr, {
              baseSalary,
              allowances,
              payrollEligible: record.payroll_eligible ?? true,
            });
          }
        }
      }
    }

    // 5. Fail closed if any active employee is missing compensation
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

    // Filter out employees not eligible for payroll
    const payrollEligibleEmployees = employeeList.filter((emp: any) => {
      const comp = compensationByEmployeeId.get(String(emp.user_id));
      return comp && comp.payrollEligible;
    });

    // 6. Query monthly compliance reviews for periodMonth
    const { data: monthlyReviews } = await this.client
      .from('employee_monthly_payroll_reviews')
      .select(
        'user_id, discipline_bonus_eligible, early_leave_makeup_confirmed',
      )
      .eq('period_month', dto.periodMonth);

    const reviewsByUserId = new Map<string, any>();
    for (const r of monthlyReviews || []) {
      reviewsByUserId.set(String(r.user_id), r);
    }

    // 7. Insert new payroll run
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

    // 8. Calculate payslip for each eligible employee
    for (const emp of payrollEligibleEmployees) {
      const compensation = compensationByEmployeeId.get(String(emp.user_id));
      if (!compensation) continue;

      const { baseSalary, allowances } = compensation;

      // Determine employee's active date range within this payroll month
      const empJoined =
        emp.joined_date && emp.joined_date > startDate
          ? emp.joined_date
          : startDate;
      const empLeft =
        emp.left_date && emp.left_date < endDate ? emp.left_date : endDate;

      const eligibleCompanyWorkDays = companyWorkDays.filter(
        (d: any) => d.work_date >= empJoined && d.work_date <= empLeft,
      );
      const eligibleWorkDatesSet = new Set(
        eligibleCompanyWorkDays.map((d: any) => d.work_date),
      );

      // Query employee attendance records for this month
      const { data: attendances } = await this.client
        .from('attendance_records')
        .select(
          'id, attendance_date, status, late_minutes, early_leave_minutes',
        )
        .eq('user_id', emp.user_id)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      // Distinct attendance dates that fall on eligible company work days
      const workedDates = new Set<string>();
      const lateMinutesList: number[] = [];
      const earlyLeaveMinutesList: number[] = [];

      for (const att of attendances || []) {
        if (eligibleWorkDatesSet.has(att.attendance_date)) {
          workedDates.add(att.attendance_date);
          if (att.late_minutes && Number(att.late_minutes) > 0) {
            lateMinutesList.push(Number(att.late_minutes));
          }
          if (att.early_leave_minutes && Number(att.early_leave_minutes) > 0) {
            earlyLeaveMinutesList.push(Number(att.early_leave_minutes));
          }
        }
      }

      const actualWorkedDays = workedDates.size;
      const absenceDays = Math.max(
        0,
        eligibleCompanyWorkDays.length - actualWorkedDays,
      );

      // Calculate attendance penalties
      const penaltyRes = calculateAttendancePenalty(lateMinutesList);

      // Check monthly compliance review
      const review = reviewsByUserId.get(String(emp.user_id));
      const disciplineEligible = review?.discipline_bonus_eligible ?? true;
      const earlyLeaveConfirmed = review?.early_leave_makeup_confirmed ?? true;
      const unapprovedEarlyLeaveOccurrences =
        !earlyLeaveConfirmed && earlyLeaveMinutesList.length > 0
          ? earlyLeaveMinutesList.length
          : 0;

      // Calculate attendance bonus
      const bonusRes = calculateAttendanceBonus({
        lateOccurrences: penaltyRes.lateOccurrences,
        absenceDays,
        unapprovedEarlyLeaveOccurrences,
        disciplineEligible,
      });

      // Salary formula
      const dailyRate = baseSalary / companyStandardDays;
      const earnedBase = Math.round(dailyRate * actualWorkedDays);
      const overtimePay = 0;
      const otherBonus = 0;
      const otherDeductions = 0;

      const attendancePenaltyAmount = penaltyRes.totalPenalty;
      const attendanceBonusAmount = bonusRes.bonusAmount;

      const grossSalary =
        earnedBase +
        allowances +
        overtimePay +
        otherBonus +
        attendanceBonusAmount;
      const totalDeductions = otherDeductions + attendancePenaltyAmount;
      const netSalary = grossSalary - totalDeductions;

      totalGross += grossSalary;
      totalNet += netSalary;

      payslipInserts.push({
        payroll_run_id: runId,
        user_id: emp.user_id,
        employee_profile_id: emp.user_id,
        standard_working_days: companyStandardDays,
        actual_worked_days: actualWorkedDays,
        paid_leave_days: 0,
        unpaid_leave_days: 0,
        base_salary: baseSalary,
        allowances,
        overtime_pay: overtimePay,
        bonus: otherBonus,
        deductions: totalDeductions,
        gross_salary: grossSalary,
        net_salary: netSalary,
        payment_status: 'unpaid',
        attendance_penalty_amount: attendancePenaltyAmount,
        attendance_bonus_amount: attendanceBonusAmount,
        late_occurrences: penaltyRes.lateOccurrences,
        late_minutes: penaltyRes.totalLateMinutes,
        absence_days: absenceDays,
        early_leave_occurrences: earlyLeaveMinutesList.length,
        early_leave_minutes: earlyLeaveMinutesList.reduce(
          (acc, m) => acc + m,
          0,
        ),
        attendance_bonus_eligible: bonusRes.bonusEligible,
      });
    }

    if (payslipInserts.length > 0) {
      const { error: insertErr } = await this.client
        .from('payslips')
        .insert(payslipInserts);

      if (insertErr) {
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
    this.assertAdminOrAccountant(user);

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
    this.assertAdminOrAccountant(user);

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
