"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Calendar,
} from "lucide-react";
import { financeApi, Invoice } from "@/lib/api/finance";

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await financeApi.getInvoices({
        page,
        pageSize,
      });
      setInvoices(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải hóa đơn khách hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [page]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue =
      (status === "issued" || status === "partially_paid") &&
      new Date(dueDate) < new Date();

    if (status === "overdue" || isOverdue) {
      return (
        <span className="px-2 py-1 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">
          Quá hạn
        </span>
      );
    }

    switch (status) {
      case "issued":
        return (
          <span className="px-2 py-1 rounded bg-[#FFC400]/10 text-[#FFC400] text-[10px] font-bold">
            Chờ thanh toán
          </span>
        );
      case "partially_paid":
        return (
          <span className="px-2 py-1 rounded bg-[#00E5FF]/10 text-[#00E5FF] text-[10px] font-bold">
            Thanh toán một phần
          </span>
        );
      case "paid":
        return (
          <span className="px-2 py-1 rounded bg-[#00E676]/10 text-[#00E676] text-[10px] font-bold">
            Đã thanh toán
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 rounded bg-[#FF1744]/10 text-[#FF1744] text-[10px] font-bold">
            Đã hủy
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href="/app/client"
          className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="font-bold text-base tracking-wide text-white">
          Cổng thông tin khách hàng{" "}
          <span className="text-[#FFC400] font-normal">
            | Hóa đơn & Công nợ
          </span>
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="border-b border-[#151516] pb-4">
          <h1 className="text-2xl font-extrabold text-white">
            Lịch sử hóa đơn
          </h1>
          <p className="text-xs text-[#606060] mt-1">
            Theo dõi chi tiết công nợ, hóa đơn chờ xử lý và lịch sử thanh toán
            của doanh nghiệp.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 bg-[#0E0E0F] border border-[#151516] rounded-2xl">
            <Loader2 className="w-6 h-6 text-[#FFC400] animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060] space-y-3">
            <FileText className="w-12 h-12 text-[#151516] mx-auto" />
            <p className="text-xs">
              Không có hóa đơn công khai nào được ghi nhận cho tài khoản của
              bạn.
            </p>
          </div>
        ) : (
          <div className="bg-[#0E0E0F] border border-[#151516] rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#151516] text-[#606060] text-xs font-semibold uppercase tracking-wider bg-[#0c0c0d]">
                    <th className="px-6 py-4">Mã số hóa đơn</th>
                    <th className="px-6 py-4">Ngày phát hành</th>
                    <th className="px-6 py-4">Hạn thanh toán</th>
                    <th className="px-6 py-4">Tổng tiền</th>
                    <th className="px-6 py-4">Đã thanh toán</th>
                    <th className="px-6 py-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516] text-sm text-[#FFF8E6]/80">
                  {invoices.map((i) => (
                    <tr
                      key={i.id}
                      className="hover:bg-[#151516]/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-white">
                        {i.invoice_number}
                      </td>
                      <td className="px-6 py-4 font-mono">{i.issue_date}</td>
                      <td className="px-6 py-4 font-mono">{i.due_date}</td>
                      <td className="px-6 py-4 font-extrabold text-white">
                        {formatCurrency(i.amount, i.currency_code)}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-[#00E676]">
                        {formatCurrency(i.paid_amount, i.currency_code)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(i.status, i.due_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-[#151516] flex items-center justify-between text-xs text-[#606060] bg-[#0c0c0d]">
                <span>
                  Hiển thị{" "}
                  <span className="text-[#FFF8E6]">{invoices.length}</span>/
                  <span className="text-[#FFF8E6]">{total}</span> hóa đơn
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 rounded-lg bg-[#151516] border border-[#1f1f22] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-[#FFF8E6]">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 rounded-lg bg-[#151516] border border-[#1f1f22] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
