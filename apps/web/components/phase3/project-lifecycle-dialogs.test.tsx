import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsApi, type Project } from "@/lib/api/projects";
import { ProjectLifecycleDialogs } from "./project-lifecycle-dialogs";

vi.mock("@/lib/api/projects", () => ({
  projectsApi: { getCompletionCheck: vi.fn(), updateProject: vi.fn() },
}));

const project = {
  id: "project-1",
  name: "Website Hồ Mộc",
  projectCode: "DA_07",
} as Project;

function renderDialogs(
  overrides: { completeOpen?: boolean; archiveOpen?: boolean } = {},
) {
  const onUpdated = vi.fn();
  const onCloseComplete = vi.fn();
  const onCloseArchive = vi.fn();
  render(
    <ProjectLifecycleDialogs
      project={project}
      completeOpen={overrides.completeOpen ?? false}
      archiveOpen={overrides.archiveOpen ?? false}
      onCloseComplete={onCloseComplete}
      onCloseArchive={onCloseArchive}
      onUpdated={onUpdated}
    />,
  );
  return { onUpdated, onCloseComplete, onCloseArchive };
}

describe("ProjectLifecycleDialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.updateProject).mockResolvedValue({
      id: "project-1",
    } as never);
  });

  it("blocks the acceptance and lists what is still open", async () => {
    vi.mocked(projectsApi.getCompletionCheck).mockResolvedValue({
      projectId: "project-1",
      ready: false,
      blockers: [
        {
          code: "OPEN_TASKS",
          count: 2,
          message: "2 công việc chưa hoàn thành hoặc chưa hủy",
        },
      ],
      checkedAt: "2026-10-19T00:00:00Z",
    });
    renderDialogs({ completeOpen: true });

    expect(
      await screen.findByText("Chưa đủ điều kiện nghiệm thu"),
    ).toBeTruthy();
    expect(
      screen.getByText("2 công việc chưa hoàn thành hoặc chưa hủy"),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /Xác nhận hoàn tất/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(projectsApi.updateProject).not.toHaveBeenCalled();
  });

  it("completes a ready project", async () => {
    vi.mocked(projectsApi.getCompletionCheck).mockResolvedValue({
      projectId: "project-1",
      ready: true,
      blockers: [],
      checkedAt: "2026-10-19T00:00:00Z",
    });
    const { onUpdated, onCloseComplete } = renderDialogs({
      completeOpen: true,
    });

    expect(await screen.findByText(/Đủ điều kiện nghiệm thu/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận hoàn tất/ }));

    await waitFor(() =>
      expect(projectsApi.updateProject).toHaveBeenCalledWith("project-1", {
        status: "completed",
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(onCloseComplete).toHaveBeenCalled();
  });

  it("cannot be confirmed when the check itself failed", async () => {
    vi.mocked(projectsApi.getCompletionCheck).mockRejectedValue(
      new Error("Không thể kiểm tra điều kiện hoàn thành."),
    );
    renderDialogs({ completeOpen: true });

    expect(
      await screen.findByText("Không thể kiểm tra điều kiện hoàn thành."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /Xác nhận hoàn tất/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows the server's blocking message if the API still refuses", async () => {
    vi.mocked(projectsApi.getCompletionCheck).mockResolvedValue({
      projectId: "project-1",
      ready: true,
      blockers: [],
      checkedAt: "2026-10-19T00:00:00Z",
    });
    vi.mocked(projectsApi.updateProject).mockRejectedValue(
      new Error("Dự án còn hạng mục chưa hoàn tất."),
    );
    renderDialogs({ completeOpen: true });

    fireEvent.click(
      await screen.findByRole("button", { name: /Xác nhận hoàn tất/ }),
    );

    expect(
      await screen.findByText("Dự án còn hạng mục chưa hoàn tất."),
    ).toBeTruthy();
  });

  it("archives with the archived status (not cancelled)", async () => {
    renderDialogs({ archiveOpen: true });

    fireEvent.click(screen.getByRole("button", { name: /Lưu trữ dự án/ }));

    await waitFor(() =>
      expect(projectsApi.updateProject).toHaveBeenCalledWith("project-1", {
        status: "archived",
      }),
    );
    expect(projectsApi.getCompletionCheck).not.toHaveBeenCalled();
  });
});
