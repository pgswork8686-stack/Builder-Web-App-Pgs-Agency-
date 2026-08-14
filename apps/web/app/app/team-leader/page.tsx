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
} from "lucide-react";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";

export default function TeamLeaderDashboardPage() {
  const [projectCount, setProjectCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projRes] = await Promise.all([
          projectsApi.getInternalProjects(1, 10),
        ]);
        if (projRes?.total) setProjectCount(projRes.total);
      } catch {
        // Use fallback initial counts
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
            Chào Trưởng nhóm (Manager Dashboard)
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Theo dõi tiến độ dự án, đội nhóm và các nội dung đang chờ duyệt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B] px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] shadow-2xs">
            Tuần này
          </span>
        </div>
      </div>

      {/* Main Banner + Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner */}
        <div className="lg:col-span-6 rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              {projectCount} dự án đang được quản lý
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              Kiểm soát tiến độ bàn giao và các nội dung đang chờ phê duyệt hôm nay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/projects">
              <Button variant="primary" size="sm">
                Xem việc ưu tiên
              </Button>
            </Link>
            <Link href="/app/attendance">
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#00D09C] shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
                Đã check-in hôm nay
              </span>
            </Link>
          </div>
        </div>

        {/* Team Performance Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">
              Hiệu suất nhóm
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-[#0F172A]">76%</span>
              <div className="w-10 h-10 rounded-full bg-[#E6FBF5] text-[#00D09C] font-bold text-xs flex items-center justify-center border border-[#A7F3D0]">
                76
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#00D09C] flex items-center gap-1 mt-4">
            <TrendingUp className="w-3.5 h-3.5" />
            +6% so với tuần trước
          </span>
        </div>

        {/* Overdue Tasks Metric */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#64748B]">
              Task cần chú ý
            </span>
            <div className="text-3xl font-black text-[#0F172A] mt-2">03</div>
          </div>
          <span className="text-xs font-bold text-[#FF785A] mt-4">
            Cần điều phối nhân lực
          </span>
        </div>
      </div>

      {/* 5 Pastel KPI Counters Row matching Figma */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          variant="blue"
          title="Dự án"
          value={projectCount.toString().padStart(2, "0")}
          badge="DA"
        />
        <StatCard
          variant="cyan"
          title="Task mở"
          value="34"
          badge="CV"
        />
        <StatCard
          variant="gold"
          title="Chờ duyệt"
          value="07"
          badge="DU"
        />
        <StatCard
          variant="green"
          title="Thành viên"
          value="12"
          badge="TV"
        />
        <StatCard
          variant="purple"
          title="Deadline"
          value="14"
          badge="DL"
        />
      </div>

      {/* 2 Middle Columns: Workload Chart & Pending Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Workload Bar Display */}
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Khối lượng công việc
              </h3>
              <p className="text-xs text-[#64748B]">Cập nhật theo dữ liệu gần nhất</p>
            </div>
            <span className="text-xs text-[#64748B] px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0]">
              7 ngày qua
            </span>
          </div>

          <div className="h-44 flex items-end justify-between gap-3 px-2 pt-6">
            {[
              { day: "T2", h1: "45%", h2: "30%" },
              { day: "T3", h1: "65%", h2: "50%" },
              { day: "T4", h1: "55%", h2: "40%" },
              { day: "T5", h1: "80%", h2: "60%" },
              { day: "T6", h1: "70%", h2: "55%" },
              { day: "T7", h1: "90%", h2: "70%" },
              { day: "CN", h1: "75%", h2: "60%" },
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

        {/* Pending Reviews Box */}
        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Cần phê duyệt
            </h3>
            <Link
              href="/app/admin/leave"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { num: "01", title: "Bộ ảnh social SOLMAX", sub: "Thiết kế • 5 phút", time: "Hôm nay" },
              { num: "02", title: "Báo cáo SEO tháng 7", sub: "SEO • 18 phút", time: "04/08" },
              { num: "03", title: "UI Dashboard PGS Hub", sub: "Web App • 42 phút", time: "05/08" },
              { num: "04", title: "Đơn nghỉ phép nhân viên", sub: "Nhân sự • 1 giờ", time: "07/08" },
            ].map((item) => (
              <div
                key={item.num}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-[#EDF2F7] hover:border-[#4F75FF]/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F75FF] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {item.num}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#64748B]">{item.sub}</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#64748B] shrink-0">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 2 Bottom Columns: Projects Attention & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Dự án cần chú ý
            </h3>
            <Link
              href="/app/projects"
              className="text-xs font-bold text-[#4F75FF] hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="divide-y divide-[#EDF2F7] text-xs">
            <div className="grid grid-cols-4 pb-2 font-semibold text-[#64748B]">
              <span className="col-span-2">Dự án</span>
              <span>Tiến độ</span>
              <span>Trạng thái</span>
            </div>
            {[
              { name: "PGS Hub Backend", prog: "41%", status: "Có rủi ro", var: "danger" as const },
              { name: "Website PGS Agency", prog: "68%", status: "Cần chú ý", var: "warning" as const },
              { name: "SEO Global Carb", prog: "82%", status: "Ổn định", var: "success" as const },
            ].map((p) => (
              <div key={p.name} className="grid grid-cols-4 py-3 items-center">
                <span className="col-span-2 font-bold text-[#0F172A] truncate">
                  {p.name}
                </span>
                <span className="font-mono text-[#4F75FF] font-bold">{p.prog}</span>
                <Badge variant={p.var} size="sm">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Deadline gần nhất
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
              { num: "01", title: "Duyệt landing page", sub: "PGS Website", date: "Hôm nay" },
              { num: "02", title: "Báo cáo SEO tháng 7", sub: "Global Carb", date: "04/08" },
              { num: "03", title: "Bàn giao UI Dashboard", sub: "PGS Hub", date: "05/08" },
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
                <span className="text-[11px] font-bold text-[#64748B]">
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
