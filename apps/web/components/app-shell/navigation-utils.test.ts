import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./navigation-utils";
import { getNavigationForRole, type NavItem } from "./role-navigation";
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

describe("Role Navigation Structure & Indexing", () => {
  it("Admin navigation has continuous numbering and unified task module", () => {
    const groups = getNavigationForRole("admin");
    const allItems = groups.flatMap((g) => g.items);

    // Verify task item
    const taskItem = allItems.find((i) => i.title === "Công việc");
    expect(taskItem).toBeDefined();
    expect(taskItem?.href).toBe("/app/admin/tasks");
    expect(taskItem?.activePaths).toEqual([
      "/app/admin/tasks",
      "/app/admin/kanban",
      "/app/admin/calendar",
    ]);

    // Verify no separate Kanban or Calendar items in Admin sidebar
    const kanbanItem = allItems.find(
      (i) => i.title === "Kanban" && i.href === "/app/admin/kanban",
    );
    expect(kanbanItem).toBeUndefined();
    const calendarItem = allItems.find(
      (i) => i.title === "Lịch" && i.href === "/app/admin/calendar",
    );
    expect(calendarItem).toBeUndefined();

    // Verify numbering is continuous 01 to 19
    const indexes = allItems.map((i) => i.index);
    expect(indexes).toHaveLength(19);
    for (let i = 1; i <= 19; i++) {
      const expected = i.toString().padStart(2, "0");
      expect(indexes[i - 1]).toBe(expected);
    }
  });

  it("Team Leader navigation has continuous numbering and unified task module", () => {
    const groups = getNavigationForRole("team_leader");
    const allItems = groups.flatMap((g) => g.items);

    const taskItem = allItems.find((i) => i.title === "Công việc");
    expect(taskItem).toBeDefined();
    expect(taskItem?.activePaths).toEqual([
      "/app/team-leader/tasks",
      "/app/team-leader/kanban",
      "/app/team-leader/calendar",
    ]);

    const indexes = allItems.map((i) => i.index);
    expect(indexes).toHaveLength(12);
    for (let i = 1; i <= 12; i++) {
      const expected = i.toString().padStart(2, "0");
      expect(indexes[i - 1]).toBe(expected);
    }
  });

  it("Employee navigation preserves independent 'Lịch' schedule menu", () => {
    const groups = getNavigationForRole("employee");
    const allItems = groups.flatMap((g) => g.items);

    const calendarItem = allItems.find((i) => i.title === "Lịch");
    expect(calendarItem).toBeDefined();
    expect(calendarItem?.href).toBe("/app/employee/calendar");
  });
});
