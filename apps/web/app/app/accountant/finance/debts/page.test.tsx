import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { financeApi, type ReceivablesPage } from "@/lib/api/finance";
import AccountantDebtsPage from "./page";

vi.mock("@/lib/api/finance", () => ({
  financeApi: { getReceivables: vi.fn() },
}));

const data = (overrides: Partial<ReceivablesPage> = {}): ReceivablesPage => ({
  items: [
    {
      id: "inv-1",
      invoiceNumber: "INV-OLD",
      clientCompany: "Công ty ABC",
      projectName: null,
      status: "overdue",
      issueDate: "2026-01-01",
      dueDate: "2026-01-31",
      currencyCode: "VND",
      amount: 1000,
      paidAmount: 250,
      outstanding: 750,
      overdueDays: 262,
    },
    {
      id: "inv-2",
      invoiceNumber: "INV-NEW",
      clientCompany: "Công ty XYZ",
      projectName: "Website",
      status: "issued",
      issueDate: "2026-10-01",
      dueDate: "2099-12-31",
      currencyCode: "VND",
      amount: 500,
      paidAmount: 0,
      outstanding: 500,
      overdueDays: 0,
    },
  ],
  totals: { VND: { outstanding: 1250, overdue: 750 } },
  page: 1,
  pageSize: 20,
  total: 2,
  totalPages: 1,
  ...overrides,
});

describe("AccountantDebtsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows real receivables, ageing and per-currency totals", async () => {
    vi.mocked(financeApi.getReceivables).mockResolvedValue(data());

    render(<AccountantDebtsPage />);

    expect(await screen.findByText("INV-OLD")).toBeTruthy();
    expect(screen.getByText("Quá hạn 262 ngày")).toBeTruthy();
    expect(screen.getByText("Trong hạn")).toBeTruthy();
    expect(screen.getByText(/Trong đó quá hạn: 750/)).toBeTruthy();
    expect(screen.getByText("2 hóa đơn còn nợ")).toBeTruthy();
    expect(financeApi.getReceivables).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("shows the empty state and recovers from an error", async () => {
    vi.mocked(financeApi.getReceivables).mockResolvedValueOnce(
      data({ items: [], totals: {}, total: 0, totalPages: 0 }),
    );
    const { unmount } = render(<AccountantDebtsPage />);
    expect(await screen.findByText("Không có khoản công nợ nào")).toBeTruthy();
    unmount();

    vi.mocked(financeApi.getReceivables)
      .mockRejectedValueOnce(new Error("Máy chủ không phản hồi"))
      .mockResolvedValueOnce(data());
    render(<AccountantDebtsPage />);
    expect(await screen.findByText("Máy chủ không phản hồi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(await screen.findByText("INV-OLD")).toBeTruthy();
  });

  it("pages server-side", async () => {
    vi.mocked(financeApi.getReceivables)
      .mockResolvedValueOnce(data({ total: 45, totalPages: 3 }))
      .mockResolvedValueOnce(data({ total: 45, totalPages: 3, page: 2 }));

    render(<AccountantDebtsPage />);
    await screen.findByText("INV-OLD");
    expect(screen.getByText(/Trang 1 \/ 3 · 45 hóa đơn/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    await screen.findByText(/Trang 2 \/ 3/);
    expect(financeApi.getReceivables).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
    });
  });
});
