import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import { workCalendarApi } from "@/lib/api/work-calendar";
import { ProjectTaskCreateDialog } from "./project-task-create-dialog";

vi.mock("@/lib/api/projects", () => ({
  projectsApi: {
    getProjectServiceItems: vi.fn(),
  },
}));

vi.mock("@/lib/api/tasks", () => ({
  tasksApi: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/api/work-calendar", () => ({
  workCalendarApi: {
    range: vi.fn(),
  },
}));

describe("ProjectTaskCreateDialog work-calendar behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.getProjectServiceItems).mockResolvedValue([]);
    vi.mocked(tasksApi.create).mockResolvedValue({} as never);
    vi.mocked(workCalendarApi.range).mockImplementation(async (from) => ({
      from,
      to: from,
      timezone: "Asia/Ho_Chi_Minh",
      days: [
        {
          date: from,
          isWorkingDay: false,
          reason: "alternate_saturday",
          title: "Nghỉ thứ 7 cách tuần",
          sourceType: "system",
          eventType: null,
        },
      ],
    }));
  });

  it("renders a non-blocking warning for a non-working start/deadline", async () => {
    render(
      <ProjectTaskCreateDialog
        isOpen
        onClose={vi.fn()}
        onCreated={vi.fn()}
        projectId="project-1"
        projectName="Activated Carbon"
        projectCode="DA_01"
        defaultStartDate="2026-08-22"
        defaultDueDate="2026-08-22"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/là ngày nghỉ công ty/)).toHaveLength(2);
    });

    const submit = screen.getByRole("button", { name: "Tạo công việc" });
    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("still creates the project-scoped task after showing the warning", async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ProjectTaskCreateDialog
        isOpen
        onClose={onClose}
        onCreated={onCreated}
        projectId="project-1"
        projectName="Activated Carbon"
        projectCode="DA_01"
        defaultStartDate="2026-08-22"
        defaultDueDate="2026-08-22"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/là ngày nghỉ công ty/)).toHaveLength(2);
    });

    fireEvent.change(
      screen.getByPlaceholderText("VD: Thiết kế giao diện Homepage"),
      { target: { value: "Thiết kế Homepage" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Tạo công việc" }));

    await waitFor(() => {
      expect(tasksApi.create).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          title: "Thiết kế Homepage",
          startDate: "2026-08-22",
          dueDate: "2026-08-22",
        }),
      );
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
