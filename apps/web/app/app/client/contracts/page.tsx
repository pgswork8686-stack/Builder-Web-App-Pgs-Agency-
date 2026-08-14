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
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <SectionHeader
        title="Hợp đồng của doanh nghiệp"
        description="Xem danh sách các hợp đồng dịch vụ đã ký kết với PGS Agency."
        badge={`${total} Hợp đồng`}
        action={
          <Link href="/app/client">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Quay lại tổng quan
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-[#4F75FF]" />}
          title="Chưa có hợp đồng nào"
          description="Không có hợp đồng nào được công khai cho tài khoản của bạn."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {contracts.map((c) => (
              <Card
                key={c.id}
                className="p-6 flex flex-col justify-between gap-4 transition-shadow hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="text-[11px] font-mono text-[#64748B] font-bold block">
                        MÃ SỐ: {c.contract_number}
                      </span>
                      <h4 className="font-extrabold text-[#0F172A] text-base mt-0.5">
                        {c.title}
                      </h4>
                    </div>
                    <Badge
                      variant={
                        c.status === "active"
                          ? "success"
                          : c.status === "completed"
                            ? "blue"
                            : "default"
                      }
                      size="sm"
                    >
                      {c.status === "active"
                        ? "Đang hiệu lực"
                        : c.status === "completed"
                          ? "Hoàn thành"
                          : "Đã hủy"}
                    </Badge>
                  </div>

                  <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#4F75FF]" />
                    <span>
                      Hiệu lực:{" "}
                      <span className="font-mono text-[#0F172A] font-semibold">
                        {c.start_date}
                      </span>
                      {c.end_date ? ` ~ ${c.end_date}` : " (Không thời hạn)"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#EDF2F7] pt-4 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                      Giá trị hợp đồng
                    </span>
                    <span className="text-lg font-black text-[#4F75FF] block mt-0.5">
                      {formatCurrency(c.contract_value, c.currency_code)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-[#64748B] pt-4 border-t border-[#EDF2F7]">
              <span>
                Hiển thị{" "}
                <span className="font-bold text-[#0F172A]">
                  {contracts.length}
                </span>{" "}
                / {total} hợp đồng
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-bold text-[#0F172A]">
                  Trang {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
