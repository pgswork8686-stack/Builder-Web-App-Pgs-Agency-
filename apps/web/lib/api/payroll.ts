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
    user_code?: string;
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
  notes?: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
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
