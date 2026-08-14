"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Calendar,
  FolderKanban,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { attendanceApi } from "@/lib/api/attendance";
import { leaveApi } from "@/lib/api/leave";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";

export default function EmployeeDashboardPage() {
  const [checkedInTime, setCheckedInTime] = useState<string | null>(null);
  const [leaveDaysRemaining, setLeaveDaysRemaining] = useState<number>(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [attSum, leaveBalances] = await Promise.all([
          attendanceApi.getSummary(),
          leaveApi.getMyBalances(),
        ]);
        if (attSum?.today?.checkInAt) {
          setCheckedInTime(
            new Date(attSum.today.checkInAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
        if (leaveBalances?.length) {
          const totalRemaining = leaveBalances.reduce(
            (acc, b) => acc + (b.allocated_days - b.used_days),
            0,
          );
          setLeaveDaysRemaining(totalRemaining);
        }
      } catch {
        // Fallback initial
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
            Chào Nhân viên (Employee Dashboard)
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Tập trung vào công việc hôm nay, deadline, chấm công và phản hồi từ quản lý.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B] px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs">
            Hôm nay
          </span>
        </div>
      </div>

      {/* Main Banner + Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner */}
        <div className="lg:col-span-6 rounded-3xl bg-[#FEF9C3] border border-[#FEF08A] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Bạn có 8 công việc hôm nay
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              5 task đang thực hiện, 3 task chờ duyệt và 2 task cần chú ý hạn chót.
            </p>
          </div>

          <div className="pt-6">
            <Link href="/app/projects">
              <Button variant="gold" size="sm">
                Mở danh sách việc
              </Button>
            </Link>
          </div>
        </div>

        {/* Attendance Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">Chấm công</span>
            <div className="text-3xl font-black text-[#0F172A] mt-2 font-mono">
              {checkedInTime || "08:17"}
            </div>
            <span className="text-xs text-[#00D09C] font-semibold block mt-1">
              Đã check-in
            </span>
          </div>
          <div className="mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6FBF5] text-[#00B788] text-xs font-bold border border-[#A7F3D0]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đang làm việc
            </span>
          </div>
        </div>

        {/* Leave Balance Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">
              Ngày phép còn
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-[#0F172A]">
                {leaveDaysRemaining}
              </span>
              <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#4F75FF] font-bold text-xs flex items-center justify-center border border-[#E0EAFF]">
                {leaveDaysRemaining}
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#64748B] mt-4">
            Đã dùng 4 ngày
          </span>
        </div>
      </div>

      {/* 5 Pastel KPI Counters Row matching Figma */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          variant="blue"
          title="Hôm nay"
          value="08"
          badge="CV"
        />
        <StatCard
          variant="cyan"
          title="Đang làm"
          value="05"
          badge="DL"
        />
        <StatCard
          variant="gold"
          title="Chờ duyệt"
          value="03"
          badge="DU"
        />
        <StatCard
          variant="rose"
          title="Quá hạn"
          value="02"
          badge="QH"
        />
        <StatCard
          variant="green"
          title="Dự án"
          value="04"
          badge="DA"
        />
      </div>

      {/* 2 Middle Columns: Today's Tasks & Today's Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Công việc hôm nay
            </h3>
            <Link
              href="/app/projects"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="divide-y divide-[#EDF2F7] text-xs">
            <div className="grid grid-cols-12 pb-2 font-semibold text-[#64748B]">
              <span className="col-span-5">Công việc</span>
              <span className="col-span-3">Dự án</span>
              <span className="col-span-2">Hạn</span>
              <span className="col-span-2 text-right">Trạng thái</span>
            </div>
            {[
              { title: "Thiết kế slide SOLMAX", proj: "SOLMAX", time: "10:30", status: "Đang làm", var: "blue" as const },
              { title: "Tối ưu bài SEO Global Carb", proj: "Global Carb", time: "12:00", status: "Cần làm", var: "default" as const },
              { title: "Cập nhật UI PGS Hub", proj: "PGS Hub", time: "15:00", status: "Chờ duyệt", var: "gold" as const },
              { title: "Báo cáo công việc ngày", proj: "Nội bộ", time: "17:30", status: "Cần làm", var: "default" as const },
              { title: "Bổ sung file nghiệm thu", proj: "PGS Website", time: "Hôm qua", status: "Quá hạn", var: "danger" as const },
            ].map((t) => (
              <div key={t.title} className="grid grid-cols-12 py-3 items-center">
                <span className="col-span-5 font-bold text-[#0F172A] truncate">
                  {t.title}
                </span>
                <span className="col-span-3 text-[#64748B] truncate">{t.proj}</span>
                <span className="col-span-2 text-[#64748B]">{t.time}</span>
                <div className="col-span-2 text-right">
                  <Badge variant={t.var} size="sm">
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Lịch hôm nay
            </h3>
            <Link
              href="/app/projects"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { num: "01", title: "Họp tiến độ PGS Hub", sub: "14:00 • Google Meet", tag: "Dự án" },
              { num: "02", title: "Duyệt nội dung SOLMAX", sub: "16:00 • Manager", tag: "Duyệt" },
              { num: "03", title: "Báo cáo cuối ngày", sub: "17:30 • Nội bộ", tag: "Cá nhân" },
              { num: "04", title: "Đào tạo SOP SEO", sub: "04/08 • Phòng họp", tag: "Đào tạo" },
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
                  {item.tag}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 2 Bottom Columns: Notifications & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Thông báo và phản hồi
            </h3>
            <Link
              href="/app/notifications"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { num: "01", title: "Manager yêu cầu chỉnh sửa", sub: "Slide SOLMAX • 8 phút" },
              { num: "02", title: "Khách hàng đã bình luận", sub: "Website PGS • 26 phút" },
              { num: "03", title: "Tài liệu mới được phát hành", sub: "SOP báo cáo • 1 giờ" },
            ].map((item) => (
              <div
                key={item.num}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] border border-[#EDF2F7]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F75FF] font-mono font-bold text-xs flex items-center justify-center">
                  {item.num}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">{item.title}</p>
                  <p className="text-[11px] text-[#64748B]">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Thao tác nhanh
            </h3>
          </div>

          <div className="space-y-3">
            <Link
              href="/app/projects"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#EEF2FF] border border-[#E0EAFF] hover:border-[#4F75FF]/40 transition-colors group"
            >
              <span className="text-xs font-bold text-[#4F75FF]">
                Cập nhật tiến độ
              </span>
              <ChevronRight className="w-4 h-4 text-[#4F75FF] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/app/attendance"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#E6FBF5] border border-[#A7F3D0] hover:border-[#00D09C]/40 transition-colors group"
            >
              <span className="text-xs font-bold text-[#00B788]">
                Gửi báo cáo ngày
              </span>
              <ChevronRight className="w-4 h-4 text-[#00B788] group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/app/leave"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FEF9C3] border border-[#FEF08A] hover:border-[#CA8A04]/40 transition-colors group"
            >
              <span className="text-xs font-bold text-[#A16207]">
                Tạo đơn nghỉ phép
              </span>
              <ChevronRight className="w-4 h-4 text-[#A16207] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
