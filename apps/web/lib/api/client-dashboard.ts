import { request } from "./client";

export interface ClientDashboardData {
  today: string;
  company: string | null;
  kpi: {
    activeProjects: number;
    totalProjects: number;
    pendingApprovals: number;
    unpaidAmount: number;
    unpaidInvoices: number;
    nextDue: string | null;
    openTickets: number;
    completedProjects: number;
  };
  attention: {
    key: string;
    kind: "approval" | "invoice" | "ticket";
    title: string;
    detail: string;
    badge: string;
    href: string;
  }[];
  projects: {
    id: string;
    code: string | null;
    name: string;
    status: string;
    dueDate: string | null;
    progress: number;
    itemsDone: number;
    itemsTotal: number;
  }[];
  updates: { at: string; text: string }[];
}

export const clientDashboardApi = {
  get: (): Promise<ClientDashboardData> => request("/client/dashboard"),
};
