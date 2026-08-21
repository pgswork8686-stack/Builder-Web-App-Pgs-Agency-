import type React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsApi } from "@/lib/api/projects";
import { workspaceApi } from "@/lib/api/workspace";
import { workCalendarApi } from "@/lib/api/work-calendar";
import { EmbeddedCalendarView } from "./project-calendar-view";

vi.mock("@/lib/api/projects", () => ({
  projectsApi: {
    getAdminProject: vi.fn(),
    getInternalProject: vi.fn(),
  },
}));

vi.mock("@/lib/api/workspace", () => ({
  workspaceApi: {
    calendar: vi.fn(),
  },
}));

vi.mock("@/lib/api/work-calendar", () => ({
  workCalendarApi: {
    range: vi.fn(),
  },
}));

vi.mock("./project-workspace-realtime-provider", () => ({
  ProjectWorkspaceRealtimeProvider: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
  useProjectWorkspaceRealtime: () => ({
    connectionState: "offline",
    revision: 0,
    lastEvent: null,
  }),
}));

vi.mock("./project-task-create-dialog", () => ({
  ProjectTaskCreateDialog: ({
    isOpen,
    defaultStartDate,
  }: {
    isOpen: boolean;
    defaultStartDate: string;
  }) => (isOpen ? <div>TASK_CREATE_{defaultStartDate}</div> : null),
}));

describe("Project calendar work-schedule behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.getAdminProject).mockResolvedValue({
      id: "project-1",
      projectCode: "DA_01",
      clientCompanyId: "client-1",
      name: "Activated Carbon",
      status: "active",
      priority: "medium",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      currentProjectRole: "project_manager",
    });
    vi.mocked(workspaceApi.calendar).mockResolvedValue([]);
    vi.mocked(workCalendarApi.range).mockResolvedValue({
      from: "2026-07-27",
      to: "2026-09-06",
      timezone: "Asia/Ho_Chi_Minh",
      days: [
        {
          date: "2026-08-22",
          isWorkingDay: false,
          reason: "alternate_saturday",
          title: "Nghỉ thứ 7 cách tuần",
          sourceType: "system",
          eventType: null,
        },
      ],
    });
  });

  it("renders the company day status and opens task create on clicked day", async () => {
    render(
      <EmbeddedCalendarView
        mode="admin"
        projectId="project-1"
        initialMonth="2026-08"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Nghỉ thứ 7 cách tuần")).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle(/Tạo công việc ngày 2026-08-22/));

    expect(screen.getByText("TASK_CREATE_2026-08-22")).toBeTruthy();
  });
});
