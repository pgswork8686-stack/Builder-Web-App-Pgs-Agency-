"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Calendar,
  FolderKanban,
  FileText,
  UserCheck,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { attendanceApi } from "@/lib/api/attendance";
import { leaveApi } from "@/lib/api/leave";
import { projectsApi } from "@/lib/api/projects";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";

export default function EmployeeDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [checkedInTime, setCheckedInTime] = useState<string | null>(null);
  const [leaveDaysRemaining, setLeaveDaysRemaining] = useState<number>(0);
  const [taskCount, setTaskCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, attSum, leaveBalances, projRes] =
          await Promise.allSettled([
            getMe(),
            attendanceApi.getSummary(),
            leaveApi.getMyBalances(),
            projectsApi.getInternalProjects(1, 6),
          ]);

        if (meRes.status === "fulfilled") setUser(meRes.value.user);
        if (attSum.status === "fulfilled" && attSum.value?.today?.checkInAt) {
          setCheckedInTime(
            new Date(attSum.value.today.checkInAt).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
        if (
          leaveBalances.status === "fulfilled" &&
          leaveBalances.value?.length
        ) {
          const totalRemaining = leaveBalances.value.reduce(
            (acc, b) => acc + (b.allocated_days - b.used_days),
            0,
          );
          setLeaveDaysRemaining(totalRemaining);
        }
        if (projRes.status === "fulfilled") {
          setProjectCount(projRes.value.total || 0);
        }
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const userName = user?.fullName || user?.email?.split("@")[0] || "Bạn";

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#24304A] tracking-tight">
            Chào {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#7C879D] mt-1">
            Không gian làm việc cá nhân, quản lý nhiệm vụ và lịch trình hôm nay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/app/attendance">
            <Button
              variant={checkedInTime ? "secondary" : "primary"}
              size="sm"
              leftIcon={<Clock className="w-4 h-4" />}
            >
              {checkedInTime
                ? `Đã check-in (${checkedInTime})`
                : "Chấm công GPS"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Hero + 2 Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner: Bạn có X công việc hôm nay */}
        <div className="lg:col-span-6 rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#24304A] tracking-tight">
              Bạn có {taskCount} công việc hôm nay
            </h2>
            <p className="text-xs sm:text-sm text-[#5D87FF] leading-relaxed">
              Ưu tiên hoàn thành các đầu việc có deadline gần và cập nhật trạng
              thái trên bảng Kanban.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/employee/tasks">
              <Button variant="primary" size="sm">
                Xem danh sách việc
              </Button>
            </Link>
            <Link href="/app/leave">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CalendarDays className="w-4 h-4" />}
              >
                Xin nghỉ phép
              </Button>
            </Link>
          </div>
        </div>

        {/* Chấm công Card */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">Chấm công</span>
            <div className="text-2xl font-black text-[#24304A] mt-2">
              {checkedInTime || "Chưa check-in"}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#13DEB9] flex items-center gap-1 mt-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {checkedInTime ? "Đúng giờ" : "Vui lòng chấm công trước 08:30"}
          </span>
        </div>

        {/* Ngày phép còn Card */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Ngày phép còn
            </span>
            <div className="text-3xl font-black text-[#24304A] mt-2">
              {leaveDaysRemaining.toString().padStart(2, "0")}
            </div>
          </div>
          <span className="text-xs font-bold text-[#FFC400] mt-4">
            Ngày phép năm 2026
          </span>
        </div>
      </div>

      {/* 5-Metric Row: Hôm nay, Đang làm, Chờ duyệt, Quá hạn, Dự án */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Hôm nay</span>
          <p className="text-2xl font-black text-[#24304A] mt-2">
            {taskCount.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Đang làm</span>
          <p className="text-2xl font-black text-[#24304A] mt-2">00</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Chờ duyệt</span>
          <p className="text-2xl font-black text-[#24304A] mt-2">00</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-bold text-[#7C879D]">Quá hạn</span>
          <p className="text-2xl font-black text-[#24304A] mt-2">00</p>
        </Card>

        <Card className="p-4 col-span-2 sm:col-span-1">
          <span className="text-xs font-bold text-[#7C879D]">Dự án</span>
          <p className="text-2xl font-black text-[#24304A] mt-2">
            {projectCount.toString().padStart(2, "0")}
          </p>
        </Card>
      </div>

      {/* Dual Section: Công việc hôm nay & Lịch hôm nay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Công việc hôm nay
            </h3>
            <Link
              href="/app/employee/tasks"
              className="text-xs font-bold text-[#5D87FF] hover:underline flex items-center gap-1"
            >
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="p-6 text-center">
            <EmptyState
              icon={<ListTodo className="w-8 h-8 text-[#7C879D]" />}
              title="Không có công việc nào cần xử lý gấp"
              description="Bạn đã hoàn thành tất cả công việc hoặc chưa có task mới được giao."
            />
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Lịch hôm nay
            </h3>
            <span className="text-xs text-[#7C879D]">Tháng 8/2026</span>
          </div>

          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Không có sự kiện hoặc cuộc họp nào được lên lịch hôm nay.
            </p>
          </Card>
        </div>
      </div>

      {/* Dual Section: Thông báo và phản hồi & Thao tác nhanh */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Thông báo và phản hồi
          </h3>
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-[#24304A]">
              <span className="w-2 h-2 rounded-full bg-[#5D87FF]" />
              <span>Chào mừng bạn đến với PGS Hub Workspace.</span>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Thao tác nhanh
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/app/employee/tasks"
              className="p-3 rounded-2xl bg-[#EEF2FF] border border-[#E0EAFF] hover:bg-[#E0EAFF] transition-all text-center block"
            >
              <span className="text-xs font-bold text-[#5D87FF]">
                Cập nhật tiến độ
              </span>
            </Link>
            <Link
              href="/app/employee/reports"
              className="p-3 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] hover:bg-[#EEF2FF] transition-all text-center block"
            >
              <span className="text-xs font-bold text-[#24304A]">
                Gửi báo cáo ngày
              </span>
            </Link>
            <Link
              href="/app/leave"
              className="p-3 rounded-2xl bg-[#FEF9C3] border border-[#FEF08A] hover:bg-[#FEF08A] transition-all text-center block"
            >
              <span className="text-xs font-bold text-[#92400E]">
                Tạo đơn nghỉ phép
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
