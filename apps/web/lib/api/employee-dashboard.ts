import { request } from "./client";

export interface EmployeeDashboardData {
  today: string;
  kpi: {
    todayTasks: number;
    inProgress: number;
    overdue: number;
    inReview: number;
    leaveRemaining: number;
    pendingLeave: number;
    presentDays: number;
    workingDays: number;
  };
  alert: { title: string; detail: string } | null;
  urgent: {
    id: string;
    code: string | null;
    title: string;
    project: string | null;
    status: string;
    dueDate: string | null;
    overdue: boolean;
    daysLate: number;
  }[];
  notifications: {
    unread: number;
    items: {
      id: string;
      title: string;
      message: string | null;
      href: string | null;
      at: string;
      read: boolean;
    }[];
  };
  projects: {
    id: string;
    code: string | null;
    name: string;
    role: string;
    dueDate: string | null;
    progress: number;
    late: boolean;
  }[];
  schedule: { date: string; label: string }[];
}

export const employeeDashboardApi = {
  get: (): Promise<EmployeeDashboardData> => request("/employee/dashboard"),
};
