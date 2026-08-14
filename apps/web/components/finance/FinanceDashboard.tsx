"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  History,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { getMe } from "@/lib/api/auth";
import { financeApi, type AuditLog } from "@/lib/api/finance";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface FinanceDashboardProps {
  roleBasePath: string;
}

export default function FinanceDashboard({
  roleBasePath,
}: FinanceDashboardProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const me = await getMe();
      setCurrentUser(me);

      const sumRes = await financeApi.getSummary();
      setSummary(sumRes);

      const auditRes = await financeApi.getAuditLogs({ page: 1, pageSize: 10 });
      setAuditLogs(auditRes.items);
    } catch (err: any) {
      console.error("Lỗi lấy dữ liệu tổng quan tài chính:", err);
      setError(
        "Không thể tải thông tin tổng quan tài chính. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "created":
        return "Khởi tạo";
      case "updated":
        return "Cập nhật";
      case "status_changed":
        return "Chuyển trạng thái";
      case "payment_recorded":
        return "Ghi nhận thanh toán";
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white border border-[#EDF2F7] shadow-xs space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-xs text-[#64748B]">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadData}>
          Thử lại
        </Button>
      </div>
    );
  }

  const contractsList = summary?.contracts || [];
  const invoicesList = summary?.invoices || [];

  // Group by currency for metrics aggregation
  const currencies = Array.from(
    new Set([
      ...contractsList.map((c: any) => c.currency_code),
      ...invoicesList.map((i: any) => i.currency_code),
    ]),
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <SectionHeader
        title="Tổng quan Tài chính"
        description="Theo dõi tình hình hợp đồng, hóa đơn, doanh thu thực tế và nợ tồn đọng."
        badge={currentUser?.role === "admin" ? "Quản trị viên" : "Kế toán viên"}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${roleBasePath}/finance/contracts`}>
              <Button variant="secondary" size="sm">
                Hợp đồng
              </Button>
            </Link>
            <Link href={`${roleBasePath}/finance/invoices`}>
              <Button variant="primary" size="sm">
                Hóa đơn
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metrics Grid */}
      {currencies.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-8 h-8 text-[#4F75FF]" />}
          title="Chưa có dữ liệu tài chính"
          description="Chưa có số liệu tài chính được ghi nhận trong hệ thống."
        />
      ) : (
        <div className="space-y-6">
          {currencies.map((currency: any) => {
            const contractData = contractsList.find(
              (c: any) => c.currency_code === currency,
            ) || {
              active_contracts: 0,
              contracted_value: 0,
            };
            const invoiceData = invoicesList.find(
              (i: any) => i.currency_code === currency,
            ) || {
              overdue_invoices: 0,
              invoiced_amount: 0,
              received_amount: 0,
              outstanding_amount: 0,
            };

            return (
              <div key={currency} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4F75FF]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Đơn vị tiền tệ: {currency}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    variant="blue"
                    title="Giá trị hợp đồng active"
                    value={formatCurrency(
                      contractData.contracted_value,
                      currency,
                    )}
                    subtitle={`${contractData.active_contracts} hợp đồng đang có hiệu lực`}
                    icon={<TrendingUp className="w-4 h-4" />}
                  />
                  <StatCard
                    variant="gold"
                    title="Đã phát hành hóa đơn"
                    value={formatCurrency(
                      invoiceData.invoiced_amount,
                      currency,
                    )}
                    subtitle="Tổng giá trị hóa đơn đã phát hành"
                    icon={<FileText className="w-4 h-4" />}
                  />
                  <StatCard
                    variant="green"
                    title="Doanh thu thực tế"
                    value={formatCurrency(
                      invoiceData.received_amount,
                      currency,
                    )}
                    subtitle="Tổng số tiền thực tế đã thu"
                    icon={<DollarSign className="w-4 h-4" />}
                  />
                  <StatCard
                    variant={
                      invoiceData.overdue_invoices > 0 ? "rose" : "default"
                    }
                    title="Còn lại phải thu"
                    value={formatCurrency(
                      invoiceData.outstanding_amount,
                      currency,
                    )}
                    subtitle={
                      invoiceData.overdue_invoices > 0
                        ? `${invoiceData.overdue_invoices} hóa đơn quá hạn`
                        : "Trong hạn thanh toán"
                    }
                    icon={<AlertTriangle className="w-4 h-4" />}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Log Timeline Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
          <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
            <History className="w-4 h-4 text-[#4F75FF]" />
            Nhật ký thay đổi tài chính
          </h3>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-center py-6 text-xs text-[#64748B]">
            Chưa có nhật ký hoạt động nào được ghi nhận.
          </p>
        ) : (
          <div className="divide-y divide-[#EDF2F7]">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="py-3 first:pt-0 last:pb-0 flex justify-between items-start text-xs gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="blue" size="sm">
                      {log.entity_type.toUpperCase()}
                    </Badge>
                    <span className="font-bold text-[#0F172A]">
                      {getActionLabel(log.action)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Entity ID:{" "}
                    <span className="font-mono text-[#0F172A]">
                      {log.entity_id}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Thực hiện bởi:{" "}
                    <span className="font-bold text-[#0F172A]">
                      {log.actor?.full_name || log.actor?.email || "System"}
                    </span>
                  </div>
                </div>

                <span className="text-[#94A3B8] text-[11px] shrink-0 font-mono">
                  {new Date(log.created_at).toLocaleString("vi-VN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
