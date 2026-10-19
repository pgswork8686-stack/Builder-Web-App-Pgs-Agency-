"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBanner } from "@/components/ui/state-banner";
import { financeApi, type ReceivablesPage } from "@/lib/api/finance";

const PAGE_SIZE = 20;

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ${currency}`;
}

export default function AccountantDebtsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReceivablesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await financeApi.getReceivables({ page, pageSize: PAGE_SIZE }));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Không thể tải danh sách công nợ.",
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
  const totals = Object.entries(data?.totals ?? {});

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Công nợ (Accounts Receivable)"
        description="Kiểm soát công nợ khách hàng, thời hạn thanh toán và các khoản nợ quá hạn."
        badge={data ? `${data.total} hóa đơn còn nợ` : "Công nợ"}
        action={
          <Link href="/app/accountant/finance/invoices">
            <Button variant="secondary" size="sm">
              Xem hóa đơn chưa thanh toán
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

      {totals.length > 0 && (
        <section
          aria-label="Tổng công nợ"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {totals.map(([currency, sums]) => (
            <Card key={currency} className="p-5" data-currency={currency}>
              <p className="text-xs font-bold uppercase tracking-wider text-[#5F6E85]">
                Còn phải thu ({currency})
              </p>
              <p className="mt-1 text-xl font-black text-[#24304A]">
                {money(sums.outstanding, currency)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#B91C1C]">
                Trong đó quá hạn: {money(sums.overdue, currency)}
              </p>
            </Card>
          ))}
        </section>
      )}

      {loading && !data ? (
        <Card className="p-10 text-center text-xs text-[#5F6E85]">
          <div role="status">Đang tải công nợ…</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            icon={<TrendingUp className="w-10 h-10 text-[#5F6E85]" />}
            title="Không có khoản công nợ nào"
            description="Toàn bộ hóa đơn đã phát hành đều đã được thanh toán."
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
                  Hạn thanh toán
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Tổng tiền
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Đã thu
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Còn nợ
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Tình trạng
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7] text-[#24304A]">
              {rows.map((invoice) => (
                <tr key={invoice.id} data-invoice-id={invoice.id}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/app/accountant/finance/invoices/${invoice.id}`}
                      className="font-mono font-bold text-[#3453D1] hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{invoice.clientCompany ?? "—"}</td>
                  <td className="px-5 py-4 text-[#5F6E85]">
                    {invoice.dueDate}
                  </td>
                  <td className="px-5 py-4">
                    {money(invoice.amount, invoice.currencyCode)}
                  </td>
                  <td className="px-5 py-4">
                    {money(invoice.paidAmount, invoice.currencyCode)}
                  </td>
                  <td className="px-5 py-4 font-bold">
                    {money(invoice.outstanding, invoice.currencyCode)}
                  </td>
                  <td className="px-5 py-4">
                    {invoice.overdueDays > 0 ? (
                      <Badge variant="danger" size="sm">
                        Quá hạn {invoice.overdueDays} ngày
                      </Badge>
                    ) : (
                      <Badge variant="blue" size="sm">
                        Trong hạn
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Phân trang công nợ"
          className="flex items-center justify-between gap-3 text-xs text-[#5F6E85]"
        >
          <span>
            Trang {page} / {totalPages} · {data?.total ?? 0} hóa đơn
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
