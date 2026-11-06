import { request } from "./client";

export interface DashboardAttentionItem {
  key: string;
  title: string;
  detail: string;
  count: number;
  href: string;
  owner: string;
}

export interface AdminDashboardData {
  generatedAt: string;
  today: string;
  kpi: {
    activeProjects: number;
    overdueTasks: number;
    overdueProjects: number;
    pendingTotal: number;
    pending: { accounts: number; leave: number; expenses: number };
    staff: {
      total: number;
      present: number;
      late: number;
      onLeave: number;
      notCheckedIn: number;
    };
    receivable: {
      overdueAmount: number;
      overdueInvoices: number;
      totalOutstanding: number;
    };
    tickets: { open: number; waitingClient: number; urgent: number };
  };
  attention: { total: number; items: DashboardAttentionItem[] };
  staffToday: {
    id: string;
    name: string;
    role: string;
    state: "leave" | "late" | "none" | "present";
    note: string;
  }[];
  workload: {
    departmentId: string;
    name: string;
    open: number;
    overdue: number;
  }[];
  newTasks: {
    last24h: number;
    items: {
      id: string;
      code: string | null;
      title: string;
      project: string | null;
      assignee: string;
      dueDate: string | null;
      status: string;
      overdue: boolean;
    }[];
  };
  projects: {
    id: string;
    code: string | null;
    name: string;
    status: string;
    client: string | null;
    manager: string;
    dueDate: string | null;
    progress: number;
    late: boolean;
  }[];
  activity: { at: string; text: string }[];
  revenue: {
    months: { key: string; label: string; amount: number }[];
    ytd: number;
    receivable: number;
    overdue: number;
  };
  schedule: { date: string; label: string; kind: string }[];
}

export const adminDashboardApi = {
  get: (): Promise<AdminDashboardData> => request("/admin/dashboard"),
};
