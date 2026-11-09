import { request } from "./client";

export interface AccountantDashboardData {
  today: string;
  kpi: {
    incomeThisMonth: number;
    incomeChangePct: number | null;
    receivable: number;
    receivableInvoices: number;
    overdueAmount: number;
    overdueClients: number;
    pendingExpenseAmount: number;
    pendingExpenseCount: number;
    payrollStatus: string | null;
    payrollLabel: string | null;
  };
  cashflow: {
    months: { key: string; label: string; income: number; expense: number }[];
    income: number;
    expense: number;
  };
  attention: {
    total: number;
    items: {
      key: string;
      title: string;
      detail: string;
      count: number;
      href: string;
      tone: "danger" | "gold" | "green";
    }[];
  };
  recentInvoices: {
    id: string;
    number: string;
    client: string;
    amount: number;
    status: string;
    overdue: boolean;
  }[];
  debtByClient: { clientId: string; name: string; amount: number }[];
}

export const accountantDashboardApi = {
  get: (): Promise<AccountantDashboardData> => request("/accountant/dashboard"),
};
