"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  UserCheck,
  Users,
  FolderKanban,
  CreditCard,
  Bell,
  MessageSquare,
  Clock,
  ArrowRight,
  Sparkles,
  ListTodo,
  Briefcase,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { getPendingUsers, type PendingUser } from "@/lib/api/admin";
import { projectsApi, type Project } from "@/lib/api/projects";
import { peopleApi } from "@/lib/api/people";
import { clientsApi } from "@/lib/api/clients";
import { financeApi } from "@/lib/api/finance";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({
    projectCount: 0,
    taskCount: 0,
    clientCount: 0,
    peopleCount: 0,
    documentCount: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [meRes, pendingRes, projRes, peopleRes, clientRes, finRes] =
          await Promise.allSettled([
            getMe(),
            getPendingUsers(1, 10),
            projectsApi.getAdminProjects({ page: 1, pageSize: 6 }),
            peopleApi.getPeopleDirectory({ page: 1, pageSize: 1 }),
            clientsApi.getClientCompanies({ page: 1, pageSize: 1 }),
            financeApi.getSummary(),
          ]);

        if (meRes.status === "fulfilled") setUser(meRes.value.user);
        if (pendingRes.status === "fulfilled")
          setPendingUsers(pendingRes.value.items || []);
        if (projRes.status === "fulfilled") {
          setProjects(projRes.value.items || []);
          setStats((prev) => ({
            ...prev,
            projectCount: projRes.value.total || 0,
          }));
        }
        if (peopleRes.status === "fulfilled") {
          setStats((prev) => ({
            ...prev,
            peopleCount: peopleRes.value.total || 0,
          }));
        }
        if (clientRes.status === "fulfilled") {
          setStats((prev) => ({
            ...prev,
            clientCount: (clientRes.value as any)?.total || 0,
          }));
        }
        if (finRes.status === "fulfilled" && finRes.value) {
          setStats((prev) => ({
            ...prev,
            monthlyRevenue: finRes.value.total_revenue_ytd || 0,
          }));
        }
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const userName = user?.fullName || "Phùng Quốc Bảo";

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#24304A] tracking-tight">
            Chào buổi sáng, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#7C879D] mt-1">
            Đây là tình hình vận hành của PGS Agency hôm nay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#7C879D] px-3.5 py-1.5 rounded-full bg-white border border-[#EDF2F7] shadow-2xs">
            Hôm nay
          </span>
          <Link href="/app/admin/accounts/pending">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              Duyệt tài khoản{" "}
              {pendingUsers.length > 0 && `(${pendingUsers.length})`}
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Primary Hero Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Block 1: System Status */}
        <div className="rounded-3xl bg-[#E6FBF5] border border-[#A7F3D0] p-6 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-[#13DEB9] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <Badge variant="success" size="sm">
              Trực tuyến
            </Badge>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Hệ thống đang vận hành ổn định
            </h3>
            <p className="text-xs text-[#059669] mt-1 font-medium">
              API, Supabase & WebSocket hoạt động bình thường
            </p>
          </div>
        </div>

        {/* Block 2: Total Progress */}
        <div className="rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-[#5D87FF] text-white flex items-center justify-center shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <Badge variant="blue" size="sm">
              Vận hành
            </Badge>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Tiến độ tổng: {stats.projectCount} Dự án
            </h3>
            <p className="text-xs text-[#5D87FF] mt-1 font-medium">
              Theo dõi phân bổ nguồn lực & bàn giao đúng hạn
            </p>
          </div>
        </div>

        {/* Block 3: Monthly Revenue */}
        <div className="rounded-3xl bg-[#FEF9C3] border border-[#FEF08A] p-6 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC400] text-white flex items-center justify-center shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <Badge variant="gold" size="sm">
              Tài chính
            </Badge>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Doanh thu tháng
            </h3>
            <p className="text-xs text-[#B45309] mt-1 font-medium">
              Hợp đồng & hóa đơn được cập nhật tự động
            </p>
          </div>
        </div>
      </div>

      {/* 5-Metric Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link href="/app/admin/clients">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#E6FBF5] text-[#13DEB9] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#7C879D] font-medium">
                Khách hàng
              </p>
              <p className="text-lg font-black text-[#24304A] tracking-tight">
                {stats.clientCount}
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/app/admin/projects">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#5D87FF] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#7C879D] font-medium">Dự án</p>
              <p className="text-lg font-black text-[#24304A] tracking-tight">
                {stats.projectCount}
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/app/admin/tasks">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#FEF9C3] text-[#FFC400] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ListTodo className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#7C879D] font-medium">
                Công việc
              </p>
              <p className="text-lg font-black text-[#24304A] tracking-tight">
                {stats.taskCount}
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/app/admin/people">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#A855F7] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#7C879D] font-medium">Nhân sự</p>
              <p className="text-lg font-black text-[#24304A] tracking-tight">
                {stats.peopleCount}
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/app/admin/documents">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all flex items-center gap-3 group col-span-2 sm:col-span-1">
            <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] text-[#FA896B] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#7C879D] font-medium">Tài liệu</p>
              <p className="text-lg font-black text-[#24304A] tracking-tight">
                {stats.documentCount}
              </p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Dual Section: Tiến độ dự án & Chờ phê duyệt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Tiến độ dự án */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Tiến độ dự án
            </h3>
            <Link
              href="/app/admin/projects"
              className="text-xs font-bold text-[#5D87FF] hover:underline flex items-center gap-1"
            >
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card className="p-6 text-center">
              <EmptyState
                icon={<FolderKanban className="w-8 h-8 text-[#7C879D]" />}
                title="Chưa có dự án nào"
                description="Tạo dự án mới để theo dõi tiến độ công việc và phân bổ nhân sự."
                actionLabel="Tạo dự án mới"
                onAction={() => (window.location.href = "/app/admin/projects")}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[#EDF2F7]">
              {projects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-[#F6F8FC] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#5D87FF]">
                        {p.projectCode}
                      </span>
                      <h4 className="text-xs font-bold text-[#24304A] truncate">
                        {p.name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-[#7C879D] mt-0.5 truncate">
                      Khách hàng: {p.clientCompany?.name || "Chưa liên kết"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      p.status === "active"
                        ? "blue"
                        : p.status === "completed"
                          ? "success"
                          : "default"
                    }
                    size="sm"
                  >
                    {p.status}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right 5 cols: Chờ phê duyệt */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Chờ phê duyệt
            </h3>
            <Badge variant="gold" size="sm">
              {pendingUsers.length} yêu cầu
            </Badge>
          </div>

          <Card className="p-4 space-y-3">
            <Link
              href="/app/admin/accounts/pending"
              className="p-3 rounded-2xl bg-[#EEF2FF] border border-[#E0EAFF] flex items-center justify-between hover:bg-[#E0EAFF] transition-all block"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#5D87FF] text-white flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-[#24304A]">
                    Tài khoản chờ duyệt
                  </h5>
                  <p className="text-[11px] text-[#7C879D]">
                    {pendingUsers.length} tài khoản mới đăng ký
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#5D87FF]" />
            </Link>

            <Link
              href="/app/admin/leave"
              className="p-3 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] flex items-center justify-between hover:bg-[#EEF2FF] transition-all block"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FFC400] text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-[#24304A]">
                    Đơn nghỉ phép
                  </h5>
                  <p className="text-[11px] text-[#7C879D]">
                    Kiểm tra và phê duyệt nghỉ phép
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7C879D]" />
            </Link>
          </Card>
        </div>
      </div>

      {/* Dual Section: Dự án cần chú ý & Hoạt động gần đây */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Dự án cần chú ý
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Tất cả các dự án đang trong ngưỡng thời gian an toàn.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Hoạt động gần đây
          </h3>
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#13DEB9]" />
              <span className="text-[#24304A] font-medium">
                Hệ thống khởi chạy thành công
              </span>
              <span className="text-[10px] text-[#7C879D] ml-auto">
                Vừa xong
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Full-Width Section: Duyệt tài khoản và phân quyền mới */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[#24304A] tracking-tight">
              Duyệt tài khoản và phân quyền mới
            </h3>
            <p className="text-xs text-[#7C879D] mt-0.5">
              Danh sách người dùng mới đăng ký chờ xét duyệt vai trò và bộ phận
              làm việc.
            </p>
          </div>
          <Link href="/app/admin/accounts/pending">
            <Button variant="secondary" size="sm">
              Xem tất cả ({pendingUsers.length})
            </Button>
          </Link>
        </div>

        {pendingUsers.length === 0 ? (
          <Card className="p-8 text-center">
            <EmptyState
              icon={<UserCheck className="w-10 h-10 text-[#13DEB9]" />}
              title="Không có yêu cầu chờ duyệt"
              description="Hiện tại tất cả tài khoản đã được phê duyệt và phân quyền đầy đủ."
            />
          </Card>
        ) : (
          <TableContainer>
            <Table>
              <thead>
                <TableRow>
                  <TableHead>NGƯỜI ĐĂNG KÝ</TableHead>
                  <TableHead>LOẠI ĐỀ XUẤT</TableHead>
                  <TableHead>PHẠM VI</TableHead>
                  <TableHead>TRẠNG THÁI</TableHead>
                  <TableHead className="text-right">THAO TÁC</TableHead>
                </TableRow>
              </thead>
              <TableBody>
                {pendingUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName || u.email || "?"} size="sm" />
                        <div>
                          <p className="text-xs font-bold text-[#24304A]">
                            {u.fullName || "Chưa đặt tên"}
                          </p>
                          <p className="text-[11px] text-[#7C879D]">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="gold" size="sm">
                        {u.role ? u.role.toUpperCase() : "CHỜ PHÂN VAI TRÒ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#7C879D]">
                      Toàn hệ thống
                    </TableCell>
                    <TableCell>
                      <Badge variant="gold" size="sm">
                        {u.accountStatus.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href="/app/admin/accounts/pending">
                        <Button variant="primary" size="sm">
                          Xét duyệt
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
