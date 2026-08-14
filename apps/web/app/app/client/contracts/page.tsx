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
import { financeApi, Contract } from "@/lib/api/finance";

export default function ClientContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const loadContracts = async () => {
    try {
      setLoading(true);
      const res = await financeApi.getContracts({
        page,
        pageSize,
      });
      setContracts(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error("Lỗi tải hợp đồng khách hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [page]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] text-[10px] font-bold">
            Đang hiệu lực
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF] text-[10px] font-bold">
            Hoàn thành
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/20 text-[#FF1744] text-[10px] font-bold">
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
            | Danh sách hợp đồng
          </span>
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="border-b border-[#151516] pb-4">
          <h1 className="text-2xl font-extrabold text-white">
            Hợp đồng của doanh nghiệp
          </h1>
          <p className="text-xs text-[#606060] mt-1">
            Xem danh sách các hợp đồng dịch vụ đã ký kết với PGS Agency.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 bg-[#0E0E0F] border border-[#151516] rounded-2xl">
            <Loader2 className="w-6 h-6 text-[#FFC400] animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center p-12 rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060] space-y-3">
            <FileText className="w-12 h-12 text-[#151516] mx-auto" />
            <p className="text-xs">
              Không có hợp đồng nào được công khai cho tài khoản của bạn.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] flex flex-col justify-between gap-4 shadow-xl hover:border-[#FFC400]/25 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-[#606060] font-bold block">
                          MÃ SỐ: {c.contract_number}
                        </span>
                        <h4 className="font-extrabold text-white text-base mt-0.5">
                          {c.title}
                        </h4>
                      </div>
                      {getStatusBadge(c.status)}
                    </div>

                    <div className="text-xs text-[#606060] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Hiệu lực:{" "}
                        <span className="font-mono">{c.start_date}</span>
                        {c.end_date ? ` ~ ${c.end_date}` : " (Không thời hạn)"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[#151516] pt-4 flex justify-between items-end">
                    <div>
                      <span className="text-[9px] font-bold text-[#606060] uppercase block">
                        Giá trị hợp đồng
                      </span>
                      <span className="text-lg font-black text-[#FFC400] block mt-0.5">
                        {formatCurrency(c.contract_value, c.currency_code)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-[#606060] pt-4">
                <span>
                  Hiển thị{" "}
                  <span className="text-[#FFF8E6]">{contracts.length}</span>/
                  <span className="text-[#FFF8E6]">{total}</span> hợp đồng
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
