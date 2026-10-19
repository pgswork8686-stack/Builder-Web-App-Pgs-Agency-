import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  financeApi,
  type FinancePage,
  type PaymentLedgerItem,
} from "@/lib/api/finance";
import AccountantPaymentsPage from "./page";

vi.mock("@/lib/api/finance", () => ({
  financeApi: { getPaymentLedger: vi.fn() },
}));

const payment = (
  id: string,
  overrides: Partial<PaymentLedgerItem> = {},
): PaymentLedgerItem => ({
  id,
  invoiceId: `invoice-${id}`,
  invoiceNumber: `INV-${id}`,
  invoiceStatus: "partially_paid",
  clientCompany: "Công ty ABC",
  currencyCode: "VND",
  amount: 4000000,
  paidAt: "2026-10-19T03:00:00.000Z",
  paymentMethod: "Chuyển khoản ngân hàng",
  paymentReference: `REF-${id}`,
  recordedBy: "Kế toán A",
  invoiceAmount: 10000000,
  invoicePaidAmount: 4000000,
  invoiceOutstanding: 6000000,
  ...overrides,
});

const page = (
  items: PaymentLedgerItem[],
  overrides: Partial<FinancePage<PaymentLedgerItem>> = {},
): FinancePage<PaymentLedgerItem> => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  totalPages: items.length > 0 ? 1 : 0,
  ...overrides,
});

describe("AccountantPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists recorded payments with the amount still owed on each invoice", async () => {
    vi.mocked(financeApi.getPaymentLedger).mockResolvedValue(
      page([payment("a"), payment("b", { invoiceOutstanding: 0 })]),
    );

    render(<AccountantPaymentsPage />);

    expect(await screen.findByText("INV-a")).toBeTruthy();
    expect(screen.getByText("Đã tất toán")).toBeTruthy();
    expect(screen.getByText(/Chuyển khoản ngân hàng · REF-a/)).toBeTruthy();
    expect(screen.getByText("2 giao dịch")).toBeTruthy();
    expect(financeApi.getPaymentLedger).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("shows the empty state and recovers from an error", async () => {
    vi.mocked(financeApi.getPaymentLedger).mockResolvedValueOnce(page([]));
    const { unmount } = render(<AccountantPaymentsPage />);
    expect(
      await screen.findByText("Chưa có giao dịch thanh toán nào"),
    ).toBeTruthy();
    unmount();

    vi.mocked(financeApi.getPaymentLedger)
      .mockRejectedValueOnce(new Error("Máy chủ không phản hồi"))
      .mockResolvedValueOnce(page([payment("c")]));
    render(<AccountantPaymentsPage />);
    expect(await screen.findByText("Máy chủ không phản hồi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(await screen.findByText("INV-c")).toBeTruthy();
  });

  it("pages server-side", async () => {
    vi.mocked(financeApi.getPaymentLedger)
      .mockResolvedValueOnce(
        page([payment("p1")], { total: 45, totalPages: 3 }),
      )
      .mockResolvedValueOnce(
        page([payment("p2")], { total: 45, totalPages: 3, page: 2 }),
      );

    render(<AccountantPaymentsPage />);
    await screen.findByText("INV-p1");

    fireEvent.click(screen.getByRole("button", { name: /Trang sau/ }));

    expect(await screen.findByText("INV-p2")).toBeTruthy();
    expect(financeApi.getPaymentLedger).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
    });
  });
});
