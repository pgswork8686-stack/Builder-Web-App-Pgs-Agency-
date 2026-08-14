"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ListTodo,
  UserCheck,
  Users,
  ChevronRight,
} from "lucide-react";
import { projectsApi, type Project } from "@/lib/api/projects";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { attendanceApi } from "@/lib/api/attendance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({
    projectCount: 0,
    openTasks: 0,
    pendingApprovals: 0,
    teamMembers: 0,
    nearDeadlines: 0,
  });
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, projRes, attSum] = await Promise.allSettled([
          getMe(),
          projectsApi.getInternalProjects(1, 6),
          attendanceApi.getSummary(),
        ]);

        if (meRes.status === "fulfilled") setUser(meRes.value.user);
        if (projRes.status === "fulfilled") {
          setProjects(projRes.value.items || []);
          setStats((prev) => ({
            ...prev,
            projectCount: projRes.value.total || 0,
          }));
        }
        if (attSum.status === "fulfilled" && attSum.value?.today?.checkInAt) {
          setCheckedInToday(true);
        }
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const userName = user?.fullName || user?.email?.split("@")[0] || "Trưởng nhóm";

  return (
    <div className="space-y-6">
      {/* Top Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#24304A] tracking-tight">
            Chào {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#7C879D] mt-1">
            Theo dõi tiến độ dự án, đội nhóm và các nội dung đang chờ duyệt hôm nay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#7C879D] px-3.5 py-1.5 rounded-full bg-white border border-[#EDF2F7] shadow-2xs">
            Tuần này
          </span>
          <Link href="/app/team-leader/projects">
            <Button variant="primary" size="sm" leftIcon={<FolderKanban className="w-4 h-4" />}>
              Dự án của tôi
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Banner + 2 KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner: X dự án đang được quản lý */}
        <div className="lg:col-span-6 rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#24304A] tracking-tight">
              {stats.projectCount} dự án đang được quản lý
            </h2>
            <p className="text-xs sm:text-sm text-[#5D87FF] leading-relaxed">
              Kiểm soát tiến độ bàn giao và các nội dung đang chờ phê duyệt hôm nay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/team-leader/tasks">
              <Button variant="primary" size="sm">
                Xem việc ưu tiên
              </Button>
            </Link>
            <Link href="/app/team-leader/attendance">
              <span className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-2xs ${
                checkedInToday
                  ? "bg-[#E6FBF5] border-[#A7F3D0] text-[#13DEB9]"
                  : "bg-white border-[#EDF2F7] text-[#7C879D]"
              }`}>
                <CheckCircle2 className="w-4 h-4" />
                {checkedInToday ? "Đã check-in hôm nay" : "Chưa chấm công hôm nay"}
              </span>
            </Link>
          </div>
        </div>

        {/* Team Performance Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Hiệu suất nhóm
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-[#24304A]">
                {stats.projectCount > 0 ? "100%" : "—"}
              </span>
              <div className="w-10 h-10 rounded-full bg-[#E6FBF5] text-[#13DEB9] font-bold text-xs flex items-center justify-center border border-[#A7F3D0]">
                {stats.projectCount > 0 ? "OK" : "0"}
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#13DEB9] flex items-center gap-1 mt-4">
            <TrendingUp className="w-3.5 h-3.5" />
            Vận hành ổn định
          </span>
        </div>

        {/* Overdue Tasks Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Task quá hạn
            </span>
            <div className="text-3xl font-black text-[#24304A] mt-2">
              {stats.nearDeadlines.toString().padStart(2, "0")}
            </div>
          </div>
          <span className="text-xs font-bold text-[#FA896B] mt-4">
            {stats.nearDeadlines > 0 ? "Cần điều phối nhân lực" : "Không có task quá hạn"}
          </span>
        </div>
      </div>

      {/* 5 Pastel KPI Counters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Link href="/app/team-leader/projects">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7C879D]">Dự án</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#5D87FF]">DA</span>
            </div>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {stats.projectCount.toString().padStart(2, "0")}
            </p>
          </Card>
        </Link>

        <Link href="/app/team-leader/tasks">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7C879D]">Task mở</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#FFC400]">CV</span>
            </div>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {stats.openTasks.toString().padStart(2, "0")}
            </p>
          </Card>
        </Link>

        <Link href="/app/team-leader/approvals">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7C879D]">Chờ duyệt</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6FBF5] text-[#13DEB9]">DU</span>
            </div>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {stats.pendingApprovals.toString().padStart(2, "0")}
            </p>
          </Card>
        </Link>

        <Link href="/app/team-leader/teams">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7C879D]">Thành viên</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E8FF] text-[#A855F7]">TV</span>
            </div>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {stats.teamMembers.toString().padStart(2, "0")}
            </p>
          </Card>
        </Link>

        <Link href="/app/team-leader/calendar">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7C879D]">Deadline</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#FA896B]">DL</span>
            </div>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {stats.nearDeadlines.toString().padStart(2, "0")}
            </p>
          </Card>
        </Link>
      </div>

      {/* Dual Section: Khối lượng công việc & Cần phê duyệt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Khối lượng công việc
            </h3>
            <Link href="/app/team-leader/tasks" className="text-xs font-bold text-[#5D87FF] hover:underline flex items-center gap-1">
              Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card className="p-6 text-center">
              <EmptyState
                icon={<ListTodo className="w-8 h-8 text-[#7C879D]" />}
                title="Chưa có dự án nào được giao"
                description="Các dự án phụ trách sẽ hiển thị tại đây khi được phân công."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[#EDF2F7]">
              {projects.slice(0, 3).map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#F6F8FC] transition-colors">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#5D87FF]">{p.projectCode}</span>
                    <h4 className="text-xs font-bold text-[#24304A]">{p.name}</h4>
                  </div>
                  <Badge variant="blue" size="sm">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Cần phê duyệt
            </h3>
            <Badge variant="gold" size="sm">0 yêu cầu</Badge>
          </div>

          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Hiện tại không có đề xuất duyệt nào cần xử lý.
            </p>
          </Card>
        </div>
      </div>

      {/* Dual Section: Dự án cần chú ý & Deadline gần nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Dự án cần chú ý
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Tất cả các dự án đang trong tiến độ kế hoạch.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Deadline gần nhất
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Không có deadline gấp trong 24 giờ tới.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
