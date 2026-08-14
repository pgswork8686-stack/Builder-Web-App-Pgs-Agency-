"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react";
import { financeApi, Invoice } from "@/lib/api/finance";
import { isInvoiceOverdue } from "@/lib/finance-date";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <SectionHeader
        title="Lịch sử hóa đơn"
        description="Theo dõi chi tiết công nợ, hóa đơn chờ xử lý và lịch sử thanh toán của doanh nghiệp."
        badge={`${total} Hóa đơn`}
        action={
          <Link href="/app/client">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Quay lại tổng quan
            </Button>
          </Link>
        }
      />

      {/* Main Table Card */}
      <Card className="p-6 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có hóa đơn nào"
            description="Không có hóa đơn công khai nào được ghi nhận cho tài khoản của bạn."
          />
        ) : (
          <div className="space-y-4">
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Mã số hóa đơn</TableHeaderCell>
                    <TableHeaderCell>Ngày phát hành</TableHeaderCell>
                    <TableHeaderCell>Hạn thanh toán</TableHeaderCell>
                    <TableHeaderCell>Tổng tiền</TableHeaderCell>
                    <TableHeaderCell>Đã thanh toán</TableHeaderCell>
                    <TableHeaderCell>Trạng thái</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono font-bold text-[#4F75FF]">
                        {i.invoice_number}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#64748B]">
                        {i.issue_date}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#64748B]">
                        {i.due_date}
                      </TableCell>
                      <TableCell className="font-extrabold text-[#0F172A] text-xs">
                        {formatCurrency(i.amount, i.currency_code)}
                      </TableCell>
                      <TableCell className="font-extrabold text-emerald-600 text-xs">
                        {formatCurrency(i.paid_amount, i.currency_code)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            i.status === "paid"
                              ? "success"
                              : isInvoiceOverdue(i.status, i.due_date)
                                ? "danger"
                                : i.status === "issued"
                                  ? "gold"
                                  : "blue"
                          }
                          size="sm"
                        >
                          {isInvoiceOverdue(i.status, i.due_date)
                            ? "Quá hạn"
                            : i.status === "paid"
                              ? "Đã thanh toán"
                              : i.status === "issued"
                                ? "Chờ thanh toán"
                                : i.status === "partially_paid"
                                  ? "Một phần"
                                  : "Đã hủy"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-[#64748B] pt-4 border-t border-[#EDF2F7]">
                <span>
                  Hiển thị <span className="font-bold text-[#0F172A]">{invoices.length}</span> / {total} hóa đơn
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
      </Card>
    </div>
  );
}
