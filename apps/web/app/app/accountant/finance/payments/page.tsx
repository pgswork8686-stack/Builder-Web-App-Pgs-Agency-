"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, DollarSign, RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import {
  financeApi,
  type FinancePage,
  type PaymentLedgerItem,
} from "@/lib/api/finance";
import { formatVietnamDateTime } from "@/lib/finance-date";

const PAGE_SIZE = 20;

function money(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(value)} ${currency ?? ""}`.trim();
}

export default function AccountantPaymentsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FinancePage<PaymentLedgerItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await financeApi.getPaymentLedger({ page, pageSize: PAGE_SIZE }));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Không thể tải sổ thanh toán.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Thanh toán (Payments Tracking)"
        description="Theo dõi toàn bộ lịch sử giao dịch thanh toán từ các hóa đơn dịch vụ và đối chiếu với công nợ còn lại."
        badge={data ? `${data.total} giao dịch` : "Thanh toán"}
        action={
          <Link href="/app/accountant/finance/invoices">
            <Button variant="secondary" size="sm">
              Xem danh sách hóa đơn
            </Button>
          </Link>
        }
      />

      {error && (
        <StateBanner
          type="error"
          title="Không tải được dữ liệu"
          message={error}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Thử lại
            </Button>
          }
        />
      )}

      {loading && !data ? (
        <Card className="p-10 text-center text-xs text-[#5F6E85]">
          <div role="status">Đang tải sổ thanh toán…</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<DollarSign className="w-10 h-10 text-[#5F6E85]" />}
            title="Chưa có giao dịch thanh toán nào"
            description="Các khoản thanh toán được ghi nhận sẽ hiển thị chi tiết tại đây."
          />
        </Card>
      ) : (
        <Card
          className={`overflow-x-auto p-0 ${loading ? "opacity-60" : ""}`}
          aria-busy={loading}
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8FC] text-[#5F6E85] uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Hóa đơn
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Khách hàng
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Số tiền
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Thời điểm
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Phương thức · Mã tham chiếu
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Còn phải thu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7] text-[#24304A]">
              {rows.map((payment) => (
                <tr key={payment.id} data-payment-id={payment.id}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/app/accountant/finance/invoices/${payment.invoiceId}`}
                      className="font-mono font-bold text-[#3453D1] hover:underline"
                    >
                      {payment.invoiceNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{payment.clientCompany ?? "—"}</td>
                  <td className="px-5 py-4 font-bold">
                    {money(payment.amount, payment.currencyCode)}
                  </td>
                  <td className="px-5 py-4 text-[#5F6E85]">
                    {formatVietnamDateTime(payment.paidAt)}
                  </td>
                  <td className="px-5 py-4 text-[#5F6E85]">
                    {[payment.paymentMethod, payment.paymentReference]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-4">
                    {payment.invoiceOutstanding === 0
                      ? "Đã tất toán"
                      : money(payment.invoiceOutstanding, payment.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Phân trang thanh toán"
          className="flex items-center justify-between gap-3 text-xs text-[#5F6E85]"
        >
          <span>
            Trang {page} / {totalPages} · {data?.total ?? 0} giao dịch
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Trang trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
