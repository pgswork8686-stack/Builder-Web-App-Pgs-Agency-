import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";
import { TaskReviewPanel } from "./task-review-panel";

vi.mock("@/lib/api/tasks", () => ({
  tasksApi: { update: vi.fn() },
}));

const task = (overrides: Partial<ProjectTask> = {}): ProjectTask =>
  ({
    id: "task-1",
    title: "Thiết kế banner",
    status: "review",
    canUpdateStatus: true,
    canApprove: true,
    ...overrides,
  }) as ProjectTask;

function renderPanel(value: ProjectTask) {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const onError = vi.fn();
  render(
    <TaskReviewPanel
      task={value}
      projectId="project-1"
      onChanged={onChanged}
      onError={onError}
    />,
  );
  return { onChanged, onError };
}

describe("TaskReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApi.update).mockResolvedValue({} as never);
  });

  it("lets a manager approve a task in review", async () => {
    const { onChanged } = renderPanel(task());

    fireEvent.click(screen.getByRole("button", { name: /Duyệt hoàn thành/ }));

    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("project-1", "task-1", {
        status: "done",
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("requires a reason to send work back and never calls the API without it", async () => {
    renderPanel(task());

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chỉnh sửa/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Gửi yêu cầu chỉnh sửa$/ }),
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/tối thiểu 5 ký tự/)).toBeTruthy();
    expect(tasksApi.update).not.toHaveBeenCalled();
  });

  it("sends the trimmed reason together with the status", async () => {
    renderPanel(task());

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chỉnh sửa/ }));
    fireEvent.change(screen.getByLabelText(/Lý do cần chỉnh sửa/), {
      target: { value: "  Logo cần to hơn  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^Gửi yêu cầu chỉnh sửa$/ }),
    );

    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("project-1", "task-1", {
        status: "in_progress",
        reviewNote: "Logo cần to hơn",
      }),
    );
  });

  it("surfaces the server error and keeps the dialog open", async () => {
    vi.mocked(tasksApi.update).mockRejectedValueOnce(
      new Error("Chỉ quản lý dự án mới có thể duyệt."),
    );
    const { onError } = renderPanel(task());

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chỉnh sửa/ }));
    fireEvent.change(screen.getByLabelText(/Lý do cần chỉnh sửa/), {
      target: { value: "Cần sửa màu nền" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^Gửi yêu cầu chỉnh sửa$/ }),
    );

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Chỉ quản lý dự án mới có thể duyệt.",
      ),
    );
    expect(screen.getByLabelText(/Lý do cần chỉnh sửa/)).toBeTruthy();
  });

  it("gives the assignee a submit button, not an approve button", async () => {
    renderPanel(task({ status: "in_progress", canApprove: false }));

    expect(
      screen.queryByRole("button", { name: /Duyệt hoàn thành/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Gửi duyệt/ }));

    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("project-1", "task-1", {
        status: "review",
      }),
    );
  });

  it("tells the assignee the result is waiting for the Team Leader", () => {
    renderPanel(task({ status: "review", canApprove: false }));

    expect(screen.getByRole("status").textContent).toMatch(
      /chờ Trưởng nhóm duyệt/,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for an approved task or a read-only viewer", () => {
    const { container: done } = render(
      <TaskReviewPanel
        task={task({ status: "done" })}
        projectId="project-1"
        onChanged={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(done.textContent).toBe("");
    const { container: viewer } = render(
      <TaskReviewPanel
        task={task({
          status: "in_progress",
          canApprove: false,
          canUpdateStatus: false,
        })}
        projectId="project-1"
        onChanged={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(viewer.textContent).toBe("");
  });
});
