"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  Clock,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { financeApi } from "@/lib/api/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const sum = await financeApi.getSummary();
        setSummary(sum);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatVND = (amount: number) => {
    if (!amount) return "0 ₫";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#24304A] tracking-tight">
            Tổng quan tài chính (Accounting Dashboard)
          </h1>
          <p className="text-xs sm:text-sm text-[#7C879D] mt-1">
            Theo dõi doanh thu, công nợ, hóa đơn, chi phí và bảng lương.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#7C879D] px-3.5 py-1.5 rounded-full bg-white border border-[#EDF2F7] shadow-2xs">
            Tháng 8/2026
          </span>
          <Link href="/app/accountant/finance/invoices">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Receipt className="w-4 h-4" />}
            >
              Quản lý hóa đơn
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Hero: Doanh thu tháng + 2 Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner: Doanh thu tháng */}
        <div className="lg:col-span-6 rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#24304A] tracking-tight">
              Doanh thu YTD: {formatVND(summary?.total_revenue_ytd || 0)}
            </h2>
            <p className="text-xs sm:text-sm text-[#5D87FF] leading-relaxed">
              Tổng giá trị hóa đơn đã thanh toán từ các hợp đồng dịch vụ đang
              thực thi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/accountant/finance/contracts">
              <Button variant="primary" size="sm">
                Xem hợp đồng
              </Button>
            </Link>
            <Link href="/app/accountant/payroll">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              >
                Bảng lương
              </Button>
            </Link>
          </div>
        </div>

        {/* Dòng tiền ròng */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Dòng tiền ròng
            </span>
            <div className="text-2xl font-black text-[#24304A] mt-2">
              {formatVND(summary?.total_revenue_ytd || 0)}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#13DEB9] flex items-center gap-1 mt-4">
            <TrendingUp className="w-3.5 h-3.5" />
            Cân đối thu chi
          </span>
        </div>

        {/* Quá hạn */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Công nợ quá hạn
            </span>
            <div className="text-2xl font-black text-[#24304A] mt-2">
              {formatVND(summary?.total_outstanding_ar || 0)}
            </div>
          </div>
          <span className="text-xs font-bold text-[#FA896B] mt-4">
            {summary?.total_outstanding_ar
              ? "Cần đôn đốc thanh toán"
              : "Không có nợ xấu"}
          </span>
        </div>
      </div>

      {/* 5-Metric Row: Doanh thu, Phải thu, Phải trả, Quá hạn, Lương */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Doanh thu</span>
          <p className="text-lg font-black text-[#24304A] mt-2 truncate">
            {formatVND(summary?.total_revenue_ytd || 0)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Phải thu</span>
          <p className="text-lg font-black text-[#24304A] mt-2 truncate">
            {formatVND(summary?.total_outstanding_ar || 0)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Phải trả</span>
          <p className="text-lg font-black text-[#24304A] mt-2 truncate">0 ₫</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Quá hạn</span>
          <p className="text-lg font-black text-[#FA896B] mt-2 truncate">
            {formatVND(summary?.total_overdue_ar || 0)}
          </p>
        </Card>

        <Card className="p-4 col-span-2 sm:col-span-1">
          <span className="text-xs font-bold text-[#7C879D]">Lương</span>
          <p className="text-lg font-black text-[#24304A] mt-2 truncate">0 ₫</p>
        </Card>
      </div>

      {/* Dual Section: Thu và chi theo tuần & Khoản đến hạn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Thu và chi theo tuần
            </h3>
            <span className="text-xs text-[#7C879D]">Dữ liệu tự động</span>
          </div>

          <Card className="p-6 text-center">
            <EmptyState
              icon={<TrendingUp className="w-8 h-8 text-[#7C879D]" />}
              title="Chưa có dữ liệu biến động thu chi"
              description="Biểu đồ dòng tiền sẽ được cập nhật khi các giao dịch phát sinh."
            />
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Khoản đến hạn
            </h3>
            <Badge variant="gold" size="sm">
              0 khoản
            </Badge>
          </div>

          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Không có khoản thanh toán nào sắp đến hạn trong tuần này.
            </p>
          </Card>
        </div>
      </div>

      {/* Dual Section: Giao dịch gần đây & Chi phí dự án */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Giao dịch gần đây
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Chưa có giao dịch thanh toán mới trong hệ thống.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Chi phí dự án
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Chưa có phiếu đề nghị chi phí dự án nào được gửi.
            </p>
          </Card>
        </div>
      </div>

      {/* Full-Width Section: Kiểm tra và chốt bảng công */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[#24304A] tracking-tight">
              Kiểm tra và chốt bảng công
            </h3>
            <p className="text-xs text-[#7C879D] mt-0.5">
              Đối soát dữ liệu chấm công GPS của toàn bộ nhân sự trước khi tính
              lương.
            </p>
          </div>
          <Link href="/app/attendance">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Mở bảng công
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
