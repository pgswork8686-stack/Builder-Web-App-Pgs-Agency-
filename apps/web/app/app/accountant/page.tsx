"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { financeApi } from "@/lib/api/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";

export default function AccountantDashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const sum = await financeApi.getSummary();
        setSummary(sum);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Tổng quan tài chính (Accounting Dashboard)
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Theo dõi doanh thu, công nợ, hóa đơn, chi phí và bảng lương.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B] px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs">
            Tháng 8/2026
          </span>
        </div>
      </div>

      {/* Main Banner + Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner */}
        <div className="lg:col-span-6 rounded-3xl bg-[#E6FBF5] border border-[#A7F3D0] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Doanh thu tháng đạt 842 triệu
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              Đã đạt 78% mục tiêu. Có 3 hóa đơn quá hạn cần xử lý trong tuần này.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/accountant/finance/invoices">
              <Button
                variant="primary"
                size="sm"
                className="bg-[#00D09C] hover:bg-[#00B788] text-white"
              >
                Xem công nợ
              </Button>
            </Link>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#00D09C] shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
              Đã check-in 08:08
            </span>
          </div>
        </div>

        {/* Cashflow Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">
              Dòng tiền ròng
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-[#0F172A]">515M</span>
              <div className="w-10 h-10 rounded-full bg-[#E6FBF5] text-[#00D09C] font-bold text-xs flex items-center justify-center border border-[#A7F3D0]">
                ↑
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#00D09C] flex items-center gap-1 mt-4">
            <TrendingUp className="w-3.5 h-3.5" />
            +9% so với tháng trước
          </span>
        </div>

        {/* Overdue Debt Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">Quá hạn</span>
            <div className="text-3xl font-black text-[#0F172A] mt-2">78M</div>
          </div>
          <span className="text-xs font-bold text-[#FF785A] mt-4">
            3 hóa đơn cần thu
          </span>
        </div>
      </div>

      {/* 5 Pastel KPI Counters Row matching Figma */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          variant="green"
          title="Doanh thu"
          value="842M"
          badge="DT"
        />
        <StatCard
          variant="blue"
          title="Phải thu"
          value="216M"
          badge="PT"
        />
        <StatCard
          variant="cyan"
          title="Phải trả"
          value="94M"
          badge="PC"
        />
        <StatCard
          variant="rose"
          title="Quá hạn"
          value="78M"
          badge="QH"
        />
        <StatCard
          variant="gold"
          title="Lương"
          value="154M"
          badge="BL"
        />
      </div>

      {/* 2 Middle Columns: Revenue/Expense Chart & Due Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Thu và chi theo tuần
              </h3>
              <p className="text-xs text-[#64748B]">Cập nhật theo dữ liệu gần nhất</p>
            </div>
            <span className="text-xs text-[#64748B] px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
              7 ngày qua
            </span>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 px-2 pt-6">
            {[
              { day: "T1", h1: "50%", h2: "35%" },
              { day: "T2", h1: "70%", h2: "45%" },
              { day: "T3", h1: "60%", h2: "40%" },
              { day: "T4", h1: "85%", h2: "55%" },
              { day: "T5", h1: "75%", h2: "50%" },
              { day: "T6", h1: "65%", h2: "45%" },
              { day: "T7", h1: "80%", h2: "55%" },
            ].map((col) => (
              <div key={col.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center gap-1.5 h-32">
                  <div
                    style={{ height: col.h1 }}
                    className="w-3.5 bg-[#4F75FF] rounded-t-md"
                  />
                  <div
                    style={{ height: col.h2 }}
                    className="w-3.5 bg-[#38BDF8] rounded-t-md"
                  />
                </div>
                <span className="text-[11px] font-bold text-[#64748B]">
                  {col.day}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Khoản đến hạn
            </h3>
            <Link
              href="/app/accountant/finance/invoices"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { num: "01", title: "Hóa đơn Global Carb", sub: "120M • Hạn 05/08", status: "Chưa thu" },
              { num: "02", title: "Hóa đơn SOLMAX", sub: "86M • Hạn 07/08", status: "Một phần" },
              { num: "03", title: "Bảng lương tháng 7", sub: "154M • Chờ duyệt", status: "Nội bộ" },
              { num: "04", title: "Chi phí Google Ads", sub: "35M • Cần xác nhận", status: "Hôm nay" },
            ].map((item) => (
              <div
                key={item.num}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-[#EDF2F7]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F75FF] font-mono font-bold text-xs flex items-center justify-center">
                    {item.num}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">{item.title}</p>
                    <p className="text-[11px] text-[#64748B]">{item.sub}</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#64748B]">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Check & Finalize Attendance Payroll Box */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EDF2F7] pb-3">
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Kiểm tra và chốt bảng công
            </h3>
            <p className="text-xs text-[#64748B]">
              Kế toán xác minh dữ liệu đã được Manager duyệt trước khi dùng để tính lương.
            </p>
          </div>
          <span className="text-xs font-bold text-[#64748B] px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
            Tháng 7/2026
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            variant="gold"
            title="Chờ kiểm tra"
            value="07"
          />
          <StatCard
            variant="rose"
            title="Có sai lệch"
            value="03"
          />
          <StatCard
            variant="green"
            title="Đã xác nhận"
            value="24"
          />
          <StatCard
            variant="blue"
            title="Đã khóa"
            value="21"
          />
        </div>
      </Card>
    </div>
  );
}
