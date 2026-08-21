import { request } from "./client";

export interface ProjectExpense {
  id: string;
  expense_code?: string;
  project_id: string;
  project_code?: string;
  submitted_by_user_id: string;
  submitted_by_user_code?: string;
  title: string;
  amount: number;
  currency_code: string;
  expense_category:
    | "travel"
    | "software_license"
    | "equipment"
    | "outsourcing"
    | "meal_entertainment"
    | "general";
  expense_date: string;
  status: "pending" | "approved" | "rejected" | "reimbursed";
  receipt_url?: string | null;
  notes?: string | null;
  approved_by_user_id?: string | null;
  approved_by_user_code?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    name: string;
    project_code?: string;
  };
  submitted_by?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
  approved_by?: {
    id: string;
    full_name: string;
    email: string;
    user_code?: string;
  };
}

export interface ExpensesListResponse {
  items: ProjectExpense[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchExpenses(params?: {
  projectId?: string;
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExpensesListResponse> {
  const query = new URLSearchParams();
  if (params?.projectId) query.append("projectId", params.projectId);
  if (params?.status) query.append("status", params.status);
  if (params?.category) query.append("category", params.category);
  if (params?.from) query.append("from", params.from);
  if (params?.to) query.append("to", params.to);
  if (params?.page) query.append("page", String(params.page));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const qs = query.toString();
  return request<ExpensesListResponse>(`/expenses${qs ? `?${qs}` : ""}`);
}

export async function createExpense(data: {
  projectId: string;
  title: string;
  amount: number;
  currencyCode?: string;
  expenseCategory: string;
  expenseDate?: string;
  receiptUrl?: string | null;
  notes?: string | null;
}): Promise<ProjectExpense> {
  return request<ProjectExpense>("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reviewExpense(
  id: string,
  data: { action: "approved" | "rejected"; rejectionReason?: string | null },
): Promise<ProjectExpense> {
  return request<ProjectExpense>(`/expenses/${id}/review`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reimburseExpense(id: string): Promise<ProjectExpense> {
  return request<ProjectExpense>(`/expenses/${id}/reimburse`, {
    method: "POST",
  });
}
