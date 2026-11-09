import { request } from "./client";

export interface TeamLeaderDashboardData {
  today: string;
  departmentId: string | null;
  kpi: {
    projects: number;
    projectsAtRisk: number;
    openTasks: number;
    overdueTasks: number;
    overdueAssignees: number;
    pendingReview: number;
    pendingLeave: number;
    members: number;
    presentToday: number;
  };
  attention: {
    key: string;
    title: string;
    detail: string;
    count: number;
    href: string;
  }[];
  teamToday: {
    present: number;
    late: number;
    onLeave: number;
    members: {
      id: string;
      name: string;
      state: "leave" | "late" | "none" | "present";
      note: string;
    }[];
  };
  workload: { userId: string; name: string; open: number; overdue: number }[];
  projects: {
    id: string;
    code: string | null;
    name: string;
    client: string | null;
    dueDate: string | null;
    progress: number;
    late: boolean;
  }[];
}

export const teamLeaderDashboardApi = {
  get: (): Promise<TeamLeaderDashboardData> => request("/team-leader/dashboard"),
};
