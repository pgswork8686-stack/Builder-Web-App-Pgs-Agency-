"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  History,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { getMe } from "@/lib/api/auth";
import { financeApi, AuditLog } from "@/lib/api/finance";

export default function FinanceDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const me = await getMe();
      setCurrentUser(me);

      const sumRes = await financeApi.getSummary();
      setSummary(sumRes);

      const auditRes = await financeApi.getAuditLogs({ page: 1, pageSize: 10 });
      setAuditLogs(auditRes.items);
    } catch (err: any) {
      console.error("Lỗi lấy dữ liệu tổng quan tài chính:", err);
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
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
        <span className="text-sm text-[#606060]">
          Đang tải dữ liệu tài chính...
        </span>
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
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/app/admin"
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-base tracking-wide text-white">
            PGS HUB{" "}
            <span className="text-[#FFC400] font-normal">| Tài chính</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {currentUser?.role === "admin" ? "Quản trị viên" : "Kế toán viên"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#151516] pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Tổng quan Tài chính
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Theo dõi tình hình hợp đồng, hóa đơn, doanh thu thực tế và nợ tồn
              đọng.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/app/admin/finance/contracts"
              className="px-4 py-2.5 rounded-xl bg-[#151516] border border-[#FFC400]/20 hover:border-[#FFC400]/50 text-white font-bold text-sm transition-all"
            >
              Hợp đồng
            </Link>
            <Link
              href="/app/admin/finance/invoices"
              className="px-4 py-2.5 rounded-xl bg-[#FFC400] text-black font-bold text-sm transition-all hover:brightness-110"
            >
              Hóa đơn
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        {currencies.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0E0E0F] border border-[#151516] text-[#606060]">
            Chưa có số liệu tài chính được ghi nhận.
          </div>
        ) : (
          <div className="space-y-8">
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
                  <h3 className="text-lg font-bold text-[#FFC400] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FFC400]" />
                    Đơn vị tiền tệ: {currency}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Active Contracts Value */}
                    <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-2">
                      <div className="flex items-center justify-between text-[#606060]">
                        <span className="text-xs font-semibold uppercase">
                          Giá trị hợp đồng active
                        </span>
                        <TrendingUp className="w-4 h-4 text-[#FFC400]" />
                      </div>
                      <div className="text-xl font-extrabold text-white">
                        {formatCurrency(
                          contractData.contracted_value,
                          currency,
                        )}
                      </div>
                      <div className="text-xs text-[#606060]">
                        {contractData.active_contracts} hợp đồng đang có hiệu
                        lực.
                      </div>
                    </div>

                    {/* Total Invoiced */}
                    <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-2">
                      <div className="flex items-center justify-between text-[#606060]">
                        <span className="text-xs font-semibold uppercase">
                          Đã phát hành hóa đơn
                        </span>
                        <FileText className="w-4 h-4 text-[#FFC400]" />
                      </div>
                      <div className="text-xl font-extrabold text-white">
                        {formatCurrency(invoiceData.invoiced_amount, currency)}
                      </div>
                      <div className="text-xs text-[#606060]">
                        Tổng giá trị hóa đơn đã phát hành.
                      </div>
                    </div>

                    {/* Received Revenue */}
                    <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-2">
                      <div className="flex items-center justify-between text-[#606060]">
                        <span className="text-xs font-semibold uppercase">
                          Doanh thu thực tế
                        </span>
                        <DollarSign className="w-4 h-4 text-[#00E676]" />
                      </div>
                      <div className="text-xl font-extrabold text-[#00E676]">
                        {formatCurrency(invoiceData.received_amount, currency)}
                      </div>
                      <div className="text-xs text-[#606060]">
                        Tổng số tiền thực tế đã thu.
                      </div>
                    </div>

                    {/* Outstanding Debt */}
                    <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-2">
                      <div className="flex items-center justify-between text-[#606060]">
                        <span className="text-xs font-semibold uppercase">
                          Còn lại phải thu
                        </span>
                        <AlertTriangle
                          className={`w-4 h-4 ${invoiceData.overdue_invoices > 0 ? "text-[#FF1744]" : "text-[#FFC400]"}`}
                        />
                      </div>
                      <div className="text-xl font-extrabold text-white">
                        {formatCurrency(
                          invoiceData.outstanding_amount,
                          currency,
                        )}
                      </div>
                      <div className="text-xs text-[#FF1744] flex items-center gap-1">
                        {invoiceData.overdue_invoices > 0 && (
                          <span>
                            {invoiceData.overdue_invoices} hóa đơn quá hạn.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Audit Log Timeline */}
        <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
          <div className="flex items-center justify-between border-b border-[#151516] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#FFC400]" />
              Nhật ký thay đổi tài chính
            </h3>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#606060]">
              Chưa có nhật ký hoạt động nào được ghi nhận.
            </div>
          ) : (
            <div className="divide-y divide-[#151516] space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="pt-3 first:pt-0 flex justify-between items-start text-xs gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#151516] border border-[#FFC400]/20 text-[10px] text-[#FFC400] font-mono">
                        {log.entity_type.toUpperCase()}
                      </span>
                      <span className="font-bold text-white">
                        {getActionLabel(log.action)}
                      </span>
                    </div>
                    <div className="text-[#606060]">
                      Entity ID:{" "}
                      <span className="font-mono text-[#FFF8E6]/60">
                        {log.entity_id}
                      </span>
                    </div>
                    <div className="text-[#606060]">
                      Thực hiện bởi:{" "}
                      <span className="text-[#FFF8E6]">
                        {log.actor?.full_name || log.actor?.email || "System"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[#606060] text-[10px] shrink-0">
                    {new Date(log.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
