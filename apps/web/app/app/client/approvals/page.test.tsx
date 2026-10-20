import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  workflowsApi,
  type ClientApprovalItem,
  type ClientApprovalPage,
} from "@/lib/api/workflows";
import ClientApprovalsPage from "./page";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    listClientApprovals: vi.fn(),
    respondApproval: vi.fn(),
  },
}));

const row = (
  id: string,
  overrides: Partial<ClientApprovalItem> = {},
): ClientApprovalItem => ({
  id,
  status: "pending",
  requestedAt: "2026-10-15T03:42:00.000Z",
  respondedAt: null,
  projectId: "project-1",
  projectCode: "DA_01",
  projectName: "Website bán hàng",
  workflowId: "workflow-1",
  stageName: "Thiết kế giao diện",
  itemName: `Banner ${id}`,
  ...overrides,
});

const page = (
  items: ClientApprovalItem[],
  overrides: Partial<ClientApprovalPage> = {},
): ClientApprovalPage => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: items.length > 0 ? 1 : 0,
  counts: { pending: items.length, approved: 3, rejected: 1 },
  ...overrides,
});

describe("ClientApprovalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workflowsApi.respondApproval).mockResolvedValue({} as never);
  });

  it("lists pending approvals from the aggregate endpoint with tab counts", async () => {
    vi.mocked(workflowsApi.listClientApprovals).mockResolvedValue(
      page([row("a"), row("b")]),
    );

    render(<ClientApprovalsPage />);

    expect(await screen.findByText("Banner a")).toBeTruthy();
    expect(screen.getByText("Banner b")).toBeTruthy();
    expect(screen.getByText("2 chờ phản hồi")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /Đã phê duyệt \(3\)/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /Đã yêu cầu chỉnh sửa \(1\)/ }),
    ).toBeTruthy();
    expect(workflowsApi.listClientApprovals).toHaveBeenCalledWith({
      status: "pending",
      page: 1,
      pageSize: 20,
    });
  });

  it("shows the empty state, and an error banner with retry", async () => {
    vi.mocked(workflowsApi.listClientApprovals).mockResolvedValueOnce(
      page([], { counts: { pending: 0, approved: 0, rejected: 0 } }),
    );
    const { unmount } = render(<ClientApprovalsPage />);
    expect(
      await screen.findByText("Không có sản phẩm nào đang chờ duyệt"),
    ).toBeTruthy();
    unmount();

    vi.mocked(workflowsApi.listClientApprovals)
      .mockRejectedValueOnce(new Error("Máy chủ không phản hồi"))
      .mockResolvedValueOnce(page([row("a")]));
    render(<ClientApprovalsPage />);
    expect(await screen.findByText("Máy chủ không phản hồi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(await screen.findByText("Banner a")).toBeTruthy();
  });

  it("pages server-side instead of loading everything once", async () => {
    vi.mocked(workflowsApi.listClientApprovals)
      .mockResolvedValueOnce(
        page([row("p1")], { total: 45, totalPages: 3, page: 1 }),
      )
      .mockResolvedValueOnce(
        page([row("p2")], { total: 45, totalPages: 3, page: 2 }),
      );

    render(<ClientApprovalsPage />);
    expect(await screen.findByText("Banner p1")).toBeTruthy();
    expect(screen.getByText(/Trang 1 \/ 3 · 45 mục/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Trang trước/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    expect(await screen.findByText("Banner p2")).toBeTruthy();
    expect(workflowsApi.listClientApprovals).toHaveBeenLastCalledWith({
      status: "pending",
      page: 2,
      pageSize: 20,
    });
  });

  it("switches tab back to page 1 and asks for that status", async () => {
    vi.mocked(workflowsApi.listClientApprovals).mockImplementation(
      async ({ status }) =>
        status === "pending"
          ? page([row("a")])
          : page(
              [
                row("done", {
                  status: "approved",
                  respondedAt: "2026-10-16T01:00:00.000Z",
                }),
              ],
              {
                counts: { pending: 1, approved: 1, rejected: 0 },
              },
            ),
    );

    render(<ClientApprovalsPage />);
    await screen.findByText("Banner a");
    fireEvent.click(screen.getByRole("tab", { name: /Đã phê duyệt/ }));

    expect(await screen.findByText("Banner done")).toBeTruthy();
    expect(workflowsApi.listClientApprovals).toHaveBeenLastCalledWith({
      status: "approved",
      page: 1,
      pageSize: 20,
    });
    expect(
      screen.queryByRole("button", { name: /Phê duyệt Banner done/ }),
    ).toBeNull();
  });

  it("requires a note before asking for a revision and never calls the API without it", async () => {
    vi.mocked(workflowsApi.listClientApprovals).mockResolvedValue(
      page([row("a")]),
    );
    render(<ClientApprovalsPage />);
    await screen.findByText("Banner a");

    fireEvent.click(
      screen.getByRole("button", { name: "Yêu cầu chỉnh sửa Banner a" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi yêu cầu chỉnh sửa" }),
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/tối thiểu 5 ký tự/)).toBeTruthy();
    expect(workflowsApi.respondApproval).not.toHaveBeenCalled();
  });

  it("sends the revision note, then reloads the list", async () => {
    vi.mocked(workflowsApi.listClientApprovals)
      .mockResolvedValueOnce(page([row("a")]))
      .mockResolvedValueOnce(
        page([], { counts: { pending: 0, approved: 3, rejected: 2 } }),
      );
    render(<ClientApprovalsPage />);
    await screen.findByText("Banner a");

    fireEvent.click(
      screen.getByRole("button", { name: "Yêu cầu chỉnh sửa Banner a" }),
    );
    fireEvent.change(screen.getByLabelText(/Nội dung cần chỉnh sửa/), {
      target: { value: "  Logo cần to hơn  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi yêu cầu chỉnh sửa" }),
    );

    await waitFor(() =>
      expect(workflowsApi.respondApproval).toHaveBeenCalledWith(
        "project-1",
        "workflow-1",
        "a",
        { decision: "rejected", decisionNote: "Logo cần to hơn" },
      ),
    );
    expect(
      await screen.findByText(/Đã gửi yêu cầu chỉnh sửa cho "Banner a"/),
    ).toBeTruthy();
    expect(workflowsApi.listClientApprovals).toHaveBeenCalledTimes(2);
  });

  it("approves without a note and keeps the dialog open with the server error on failure", async () => {
    vi.mocked(workflowsApi.listClientApprovals).mockResolvedValue(
      page([row("a")]),
    );
    vi.mocked(workflowsApi.respondApproval).mockRejectedValueOnce(
      new Error("Approval request is no longer pending."),
    );
    render(<ClientApprovalsPage />);
    await screen.findByText("Banner a");

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt Banner a" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phê duyệt" }));

    expect(
      await screen.findByText("Approval request is no longer pending."),
    ).toBeTruthy();
    expect(workflowsApi.respondApproval).toHaveBeenCalledWith(
      "project-1",
      "workflow-1",
      "a",
      { decision: "approved", decisionNote: null },
    );
    expect(
      screen.getByRole("button", { name: "Xác nhận phê duyệt" }),
    ).toBeTruthy();
  });
});
