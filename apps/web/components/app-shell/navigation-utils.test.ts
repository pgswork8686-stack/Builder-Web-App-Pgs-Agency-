import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./navigation-utils";
import { getNavigationForRole, getActiveModuleTabs, getActiveTabHref, ROLE_LABELS, type NavItem } from "./role-navigation";
import { ListTodo, Calendar, LayoutDashboard } from "lucide-react";

describe("Navigation Utils - isNavItemActive", () => {
  const adminWorkItem: NavItem = {
    index: "10",
    title: "Công việc",
    href: "/app/admin/tasks",
    icon: ListTodo,
    activePaths: [
      "/app/admin/tasks",
      "/app/admin/kanban",
      "/app/admin/calendar",
    ],
  };

  const dashboardItem: NavItem = {
    index: "01",
    title: "Dashboard",
    href: "/app/admin",
    icon: LayoutDashboard,
    exact: true,
  };

  const employeeCalendarItem: NavItem = {
    index: "05",
    title: "Lịch",
    href: "/app/employee/calendar",
    icon: Calendar,
  };

  it("activates Admin 'Công việc' item for /app/admin/tasks and subpaths", () => {
    expect(isNavItemActive("/app/admin/tasks", adminWorkItem)).toBe(true);
    expect(isNavItemActive("/app/admin/tasks/123", adminWorkItem)).toBe(true);
  });

  it("activates Admin 'Công việc' item for /app/admin/kanban and subpaths", () => {
    expect(isNavItemActive("/app/admin/kanban", adminWorkItem)).toBe(true);
    expect(isNavItemActive("/app/admin/kanban/board-1", adminWorkItem)).toBe(
      true,
    );
  });

  it("activates Admin 'Công việc' item for /app/admin/calendar and subpaths", () => {
    expect(isNavItemActive("/app/admin/calendar", adminWorkItem)).toBe(true);
    expect(isNavItemActive("/app/admin/calendar/month", adminWorkItem)).toBe(
      true,
    );
  });

  it("does not activate Admin 'Công việc' item for other routes", () => {
    expect(isNavItemActive("/app/admin", adminWorkItem)).toBe(false);
    expect(isNavItemActive("/app/admin/projects", adminWorkItem)).toBe(false);
    expect(isNavItemActive("/app/admin/attendance", adminWorkItem)).toBe(false);
  });

  it("respects exact match for dashboard", () => {
    expect(isNavItemActive("/app/admin", dashboardItem)).toBe(true);
    expect(isNavItemActive("/app/admin/projects", dashboardItem)).toBe(false);
  });

  it("activates employee calendar independently", () => {
    expect(
      isNavItemActive("/app/employee/calendar", employeeCalendarItem),
    ).toBe(true);
    expect(isNavItemActive("/app/employee/tasks", employeeCalendarItem)).toBe(
      false,
    );
  });
});

describe("Điều hướng V2 — sidebar là module, tab là view", () => {
  const roles = ["admin", "team_leader", "employee", "accountant", "client"] as const;

  it("mỗi vai trò có tối đa 9 mục sidebar và không đánh số", () => {
    for (const r of roles) {
      const items = getNavigationForRole(r).flatMap((g) => g.items);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(9);
      expect(items.every((i) => !i.index)).toBe(true);
    }
  });

  it("Kanban và Lịch là tab của Công việc, không phải mục sidebar riêng", () => {
    const items = getNavigationForRole("team_leader").flatMap((g) => g.items);
    expect(items.some((i) => i.title === "Kanban" || i.title === "Lịch")).toBe(false);
    const work = items.find((i) => i.title === "Công việc")!;
    expect(work.tabs?.map((t) => t.href)).toEqual([
      "/app/team-leader/tasks",
      "/app/team-leader/kanban",
      "/app/team-leader/calendar",
    ]);
    expect(isNavItemActive("/app/team-leader/kanban", work)).toBe(true);
  });

  it("tab module được tìm đúng theo đường dẫn, khớp dài nhất", () => {
    const m = getActiveModuleTabs("team_leader", "/app/team-leader/projects/completed");
    expect(m?.module).toBe("Dự án");
    expect(getActiveTabHref(m!.tabs, "/app/team-leader/projects/completed")).toBe("/app/team-leader/projects/completed");
    expect(getActiveTabHref(m!.tabs, "/app/team-leader/projects")).toBe("/app/team-leader/projects");
    // trang chi tiết dự án: không chọn tab nào
    expect(getActiveTabHref(m!.tabs, "/app/team-leader/projects/abc")).toBeNull();
  });

  it("Quản trị viên và Khách hàng không có mục chấm công cá nhân", () => {
    for (const r of ["admin", "client"] as const) {
      const hrefs = getNavigationForRole(r).flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.tabs || []).map((t) => t.href)]));
      expect(hrefs).not.toContain("/app/attendance");
    }
  });

  it("Trưởng phòng, Nhân viên, Kế toán có chấm công và nghỉ phép cá nhân", () => {
    for (const r of ["team_leader", "employee", "accountant"] as const) {
      const hrefs = getNavigationForRole(r).flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.tabs || []).map((t) => t.href)]));
      expect(hrefs).toContain("/app/attendance");
      expect(hrefs).toContain("/app/leave");
    }
  });

  it("nhãn vai trò là Trưởng phòng", () => {
    expect(ROLE_LABELS.team_leader).toBe("Trưởng phòng");
  });
});
