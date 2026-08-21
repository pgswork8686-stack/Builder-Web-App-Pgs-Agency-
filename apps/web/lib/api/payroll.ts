import { request } from "./client";

export interface PayrollRun {
  id: string;
  run_code?: string;
  period_month: string;
  period_start_date: string;
  period_end_date: string;
  title: string;
  status: "draft" | "calculated" | "approved" | "paid" | "locked";
  total_gross_amount: number;
  total_net_amount: number;
  total_employees_count: number;
  approved_by_user_id?: string | null;
  approved_by_user_code?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  approved_by?: {
    id: string;
    full_name: string;
    email: string;
    account_code?: string;
  };
  payslips?: Payslip[];
}

export interface Payslip {
  id: string;
  payslip_code?: string;
  payroll_run_id: string;
  payroll_run_code?: string;
  user_id: string;
  user_code?: string;
  standard_working_days: number;
  actual_worked_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  base_salary: number;
  allowances: number;
  overtime_pay: number;
  bonus: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  payment_status: "unpaid" | "paid";
  attendance_penalty_amount?: number;
  attendance_bonus_amount?: number;
  late_occurrences?: number;
  late_minutes?: number;
  absence_days?: number;
  early_leave_occurrences?: number;
  early_leave_minutes?: number;
  attendance_bonus_eligible?: boolean;
  notes?: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    account_code?: string;
    avatar_url?: string | null;
  };
  employee_profile?: {
    job_title: string;
    department_id: string;
  };
  payroll_run?: {
    period_month: string;
    title: string;
    status: string;
    paid_at?: string | null;
  };
}

export interface PayrollRunsListResponse {
  items: PayrollRun[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeCompensationItem {
  userId: string;
  employeeCode: string;
  fullName: string | null;
  email: string | null;
  accountCode: string | null;
  jobTitle: string | null;
  employmentStatus: string;
  joinedDate: string | null;
  leftDate: string | null;
  status: "configured" | "missing" | "not_eligible";
  baseSalary: number | null;
  allowances: number | null;
  effectiveFrom: string | null;
  payrollEligible: boolean;
  notes: string | null;
  historyCount: number;
  updatedAt: string | null;
  updatedBy?: {
    id: string;
    fullName: string | null;
    email: string | null;
    accountCode: string | null;
  } | null;
}

export interface CompensationHistoryItem {
  id: string;
  baseSalary: number;
  allowances: number;
  effectiveFrom: string;
  payrollEligible: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: {
    id: string;
    fullName: string | null;
    email: string | null;
    accountCode: string | null;
  } | null;
}

export interface MonthlyPayrollReview {
  id: string;
  user_id: string;
  period_month: string;
  discipline_bonus_eligible: boolean;
  early_leave_makeup_confirmed: boolean;
  notes: string | null;
  user?: {
    id: string;
    full_name: string;
    email: string;
    account_code?: string;
  };
}

export async function fetchPayrollRuns(params?: {
  status?: string;
  year?: string;
  page?: number;
  pageSize?: number;
}): Promise<PayrollRunsListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.year) query.append("year", params.year);
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const qs = query.toString();
  return request<PayrollRunsListResponse>(`/payroll/runs${qs ? `?${qs}` : ""}`);
}

export async function fetchPayrollRunById(id: string): Promise<PayrollRun> {
  return request<PayrollRun>(`/payroll/runs/${id}`);
}

export async function generatePayrollRun(data: {
  periodMonth: string;
  title: string;
  standardWorkingDays?: number;
}): Promise<PayrollRun> {
  return request<PayrollRun>("/payroll/runs/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approvePayrollRun(id: string): Promise<PayrollRun> {
  return request<PayrollRun>(`/payroll/runs/${id}/approve`, {
    method: "POST",
  });
}

export async function payPayrollRun(id: string): Promise<PayrollRun> {
  return request<PayrollRun>(`/payroll/runs/${id}/pay`, {
    method: "POST",
  });
}

export async function fetchMyPayslips(): Promise<Payslip[]> {
  return request<Payslip[]>("/payroll/me/payslips");
}

export async function fetchEmployeeCompensations(): Promise<{
  items: EmployeeCompensationItem[];
}> {
  return request<{ items: EmployeeCompensationItem[] }>(
    "/payroll/compensations",
  );
}

export async function fetchCompensationHistory(
  userId: string,
): Promise<{ userId: string; history: CompensationHistoryItem[] }> {
  return request<{ userId: string; history: CompensationHistoryItem[] }>(
    `/payroll/compensations/${userId}/history`,
  );
}

export async function createCompensationRevision(
  userId: string,
  data: {
    baseSalary: number;
    allowances?: number;
    effectiveFrom: string;
    payrollEligible?: boolean;
    notes?: string | null;
  },
): Promise<any> {
  return request(`/payroll/compensations/${userId}/revisions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchMonthlyReviews(
  periodMonth: string,
): Promise<{ items: MonthlyPayrollReview[] }> {
  return request<{ items: MonthlyPayrollReview[] }>(
    `/payroll/monthly-reviews?periodMonth=${periodMonth}`,
  );
}

export async function upsertMonthlyReview(
  userId: string,
  periodMonth: string,
  data: {
    disciplineBonusEligible: boolean;
    earlyLeaveMakeupConfirmed: boolean;
    notes?: string | null;
  },
): Promise<any> {
  return request(
    `/payroll/monthly-reviews/${userId}?periodMonth=${periodMonth}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}
