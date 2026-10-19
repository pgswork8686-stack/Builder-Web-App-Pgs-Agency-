import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handoverApi,
  type ClientHandoverFile,
  type ClientHandoverPage,
} from "@/lib/api/files";
import ClientDocumentsPage from "./page";

vi.mock("@/lib/api/files", () => ({
  handoverApi: { listForClient: vi.fn(), downloadForClient: vi.fn() },
}));

const file = (
  id: string,
  overrides: Partial<ClientHandoverFile> = {},
): ClientHandoverFile => ({
  id,
  projectId: "project-1",
  projectCode: "DA_07",
  projectName: "Website Hồ Mộc",
  projectStatus: "completed",
  originalName: `${id}.pdf`,
  mimeType: "application/pdf",
  sizeBytes: 2048,
  handedOverAt: "2026-10-19T03:00:00.000Z",
  ...overrides,
});

const page = (
  items: ClientHandoverFile[],
  overrides: Partial<ClientHandoverPage> = {},
): ClientHandoverPage => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: items.length > 0 ? 1 : 0,
  ...overrides,
});

describe("ClientDocumentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the handed-over documents with their project", async () => {
    vi.mocked(handoverApi.listForClient).mockResolvedValue(
      page([file("ban-giao"), file("bien-ban")]),
    );

    render(<ClientDocumentsPage />);

    expect(await screen.findByText("ban-giao.pdf")).toBeTruthy();
    expect(screen.getByText("bien-ban.pdf")).toBeTruthy();
    expect(screen.getAllByText("DA_07")).toHaveLength(2);
    expect(screen.getByText("2 tài liệu")).toBeTruthy();
    expect(handoverApi.listForClient).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("shows the empty state and an error banner with retry", async () => {
    vi.mocked(handoverApi.listForClient).mockResolvedValueOnce(page([]));
    const { unmount } = render(<ClientDocumentsPage />);
    expect(
      await screen.findByText("Chưa có tài liệu bàn giao nào"),
    ).toBeTruthy();
    unmount();

    vi.mocked(handoverApi.listForClient)
      .mockRejectedValueOnce(new Error("Máy chủ không phản hồi"))
      .mockResolvedValueOnce(page([file("sau-khi-thu-lai")]));
    render(<ClientDocumentsPage />);
    expect(await screen.findByText("Máy chủ không phản hồi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(await screen.findByText("sau-khi-thu-lai.pdf")).toBeTruthy();
  });

  it("pages server-side", async () => {
    vi.mocked(handoverApi.listForClient)
      .mockResolvedValueOnce(page([file("p1")], { total: 45, totalPages: 3 }))
      .mockResolvedValueOnce(
        page([file("p2")], { total: 45, totalPages: 3, page: 2 }),
      );

    render(<ClientDocumentsPage />);
    expect(await screen.findByText("p1.pdf")).toBeTruthy();
    expect(screen.getByText(/Trang 1 \/ 3 · 45 tài liệu/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    expect(await screen.findByText("p2.pdf")).toBeTruthy();
    expect(handoverApi.listForClient).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
    });
  });

  it("downloads through the signed URL and reports a failure", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
    vi.mocked(handoverApi.listForClient).mockResolvedValue(page([file("a")]));
    vi.mocked(handoverApi.downloadForClient)
      .mockResolvedValueOnce({
        signedUrl: "https://signed.example/a",
        expiresIn: 120,
      })
      .mockRejectedValueOnce(new Error("Không tìm thấy tài liệu bàn giao."));

    render(<ClientDocumentsPage />);
    const button = await screen.findByRole("button", {
      name: "Tải xuống a.pdf",
    });

    fireEvent.click(button);
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://signed.example/a"),
    );
    expect(handoverApi.downloadForClient).toHaveBeenCalledWith("a");

    fireEvent.click(button);
    expect(
      await screen.findByText("Không tìm thấy tài liệu bàn giao."),
    ).toBeTruthy();
  });
});
