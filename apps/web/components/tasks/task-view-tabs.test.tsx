import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { TaskViewTabs } from "./task-view-tabs";

describe("TaskViewTabs Component", () => {
  it("renders all three tabs with correct labels and links for Admin", () => {
    render(<TaskViewTabs active="list" role="admin" />);

    const listTab = screen.getByRole("link", { name: /danh sách/i });
    const kanbanTab = screen.getByRole("link", { name: /kanban/i });
    const calendarTab = screen.getByRole("link", { name: /lịch biểu/i });

    expect(listTab).toBeDefined();
    expect(listTab.getAttribute("href")).toBe("/app/admin/tasks");
    expect(listTab.getAttribute("aria-current")).toBe("page");

    expect(kanbanTab.getAttribute("href")).toBe("/app/admin/kanban");
    expect(kanbanTab.getAttribute("aria-current")).toBeNull();

    expect(calendarTab.getAttribute("href")).toBe("/app/admin/calendar");
    expect(calendarTab.getAttribute("aria-current")).toBeNull();
  });

  it("renders correct active state for kanban tab in Team Leader role", () => {
    render(<TaskViewTabs active="kanban" role="team_leader" />);

    const kanbanTab = screen.getByRole("link", { name: /kanban/i });
    expect(kanbanTab.getAttribute("href")).toBe("/app/team-leader/kanban");
    expect(kanbanTab.getAttribute("aria-current")).toBe("page");

    const listTab = screen.getByRole("link", { name: /danh sách/i });
    expect(listTab.getAttribute("href")).toBe("/app/team-leader/tasks");
    expect(listTab.getAttribute("aria-current")).toBeNull();
  });

  it("renders correct active state for calendar tab", () => {
    render(<TaskViewTabs active="calendar" role="admin" />);

    const calendarTab = screen.getByRole("link", { name: /lịch biểu/i });
    expect(calendarTab.getAttribute("href")).toBe("/app/admin/calendar");
    expect(calendarTab.getAttribute("aria-current")).toBe("page");
  });
});
