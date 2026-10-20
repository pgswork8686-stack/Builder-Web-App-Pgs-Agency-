import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "@/lib/api/auth";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi, type ProjectTask } from "@/lib/api/tasks";
import EmployeeTasksPage from "./page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api/auth", () => ({ getMe: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({
  projectsApi: { getInternalProjects: vi.fn() },
}));
vi.mock("@/lib/api/tasks", () => ({
  tasksApi: { list: vi.fn(), update: vi.fn() },
}));

const task = (id: string, status: ProjectTask["status"]): ProjectTask =>
  ({
    id,
    project_id: "p1",
    title: `Việc ${id}`,
    status,
    priority: "medium",
  }) as ProjectTask;

const projects = {
  items: [{ id: "p1", name: "Dự án A" }],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function arrange(tasks: ProjectTask[]) {
  vi.mocked(getMe).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(projectsApi.getInternalProjects).mockResolvedValue(
    projects as never,
  );
  vi.mocked(tasksApi.list).mockResolvedValue({
    items: tasks,
    total: tasks.length,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  } as never);
}

describe("EmployeeTasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only lists tasks assigned to the signed-in employee", async () => {
    arrange([task("a", "todo")]);
    render(<EmployeeTasksPage />);

    expect(await screen.findByText("Việc a")).toBeTruthy();
    expect(tasksApi.list).toHaveBeenCalledWith("p1", {
      assigneeUserId: "u1",
      pageSize: 50,
    });
  });

  it("offers Gửi duyệt, never Hoàn thành, to the employee", async () => {
    arrange([task("a", "in_progress"), task("b", "review")]);
    render(<EmployeeTasksPage />);

    await screen.findByText("Việc a");
    // The only "Hoàn thành" button is the list filter tab, not a task action.
    expect(screen.getAllByRole("button", { name: "Hoàn thành" })).toHaveLength(
      1,
    );
    expect(screen.getByText("Đang chờ duyệt")).toBeTruthy();

    vi.mocked(tasksApi.update).mockResolvedValue({} as never);
    fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    await waitFor(() =>
      expect(tasksApi.update).toHaveBeenCalledWith("p1", "a", {
        status: "review",
      }),
    );
  });

  it("shows the server message when a status change is refused", async () => {
    arrange([task("a", "todo")]);
    render(<EmployeeTasksPage />);
    await screen.findByText("Việc a");

    vi.mocked(tasksApi.update).mockRejectedValue(
      new Error("Không đủ quyền cập nhật công việc này."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không đủ quyền cập nhật công việc này.",
    );
  });

  it("explains a load failure with a retry instead of an empty list", async () => {
    vi.mocked(getMe).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(projectsApi.getInternalProjects).mockRejectedValueOnce(
      new Error("Máy chủ không phản hồi"),
    );
    render(<EmployeeTasksPage />);

    expect(await screen.findByText("Máy chủ không phản hồi")).toBeTruthy();
    expect(screen.queryByText("Không có nhiệm vụ nào")).toBeNull();

    arrange([task("a", "todo")]);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Việc a")).toBeTruthy();
  });

  it("does not fall back to everybody's tasks when the account cannot be read", async () => {
    vi.mocked(getMe).mockRejectedValue(
      new Error("Phiên đăng nhập đã hết hạn."),
    );
    vi.mocked(projectsApi.getInternalProjects).mockResolvedValue(
      projects as never,
    );
    render(<EmployeeTasksPage />);

    expect(await screen.findByText("Phiên đăng nhập đã hết hạn.")).toBeTruthy();
    expect(tasksApi.list).not.toHaveBeenCalled();
  });
});
