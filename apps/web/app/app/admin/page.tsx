"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  UserCheck,
  Users,
  FolderKanban,
  CreditCard,
  Bell,
  MessageSquare,
  Bot,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  QuickActionGrid,
  type QuickActionItem,
} from "@/components/dashboard/quick-action";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  const quickActions: QuickActionItem[] = [
    {
      title: "Phê duyệt tài khoản",
      description:
        "Xét duyệt và phân quyền cho nhân sự mới đăng ký vào hệ thống.",
      href: "/app/admin/accounts/pending",
      icon: <UserCheck className="w-5 h-5" />,
      badge: "Ưu tiên",
      highlight: true,
    },
    {
      title: "Quản lý Nhân sự",
      description:
        "Danh sách nhân viên, cơ cấu phòng ban và đội nhóm chuyên môn.",
      href: "/app/admin/people",
      icon: <Users className="w-5 h-5" />,
    },
    {
      title: "Dự án & Kanban Board",
      description:
        "Theo dõi tiến độ bàn giao, phân công tasks và quản trị dự án.",
      href: "/app/admin/projects",
      icon: <FolderKanban className="w-5 h-5" />,
    },
    {
      title: "Chấm công & Nghỉ phép",
      description:
        "Kiểm soát lịch làm việc, bán kính GPS chấm công và duyệt đơn nghỉ.",
      href: "/app/admin/attendance",
      icon: <Clock className="w-5 h-5" />,
    },
    {
      title: "Quản lý Tài chính",
      description:
        "Hợp đồng dịch vụ, xuất hóa đơn và theo dõi dòng tiền doanh nghiệp.",
      href: "/app/admin/finance",
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      title: "Tự động hóa (Automation)",
      description:
        "Quy tắc tự động gửi thông báo khi có thay đổi trạng thái nghiệp vụ.",
      href: "/app/admin/automation",
      icon: <Bot className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Section Header */}
      <SectionHeader
        title="Bảng điều khiển Quản trị viên"
        description="Tổng quan hệ thống, kiểm soát phân quyền tài khoản và vận hành toàn diện PGS Agency."
        badge="Admin Center"
      />

      {/* KPI Stats Grid with Pastel Variants */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          variant="blue"
          title="Vai trò"
          value="Admin"
          subtitle="Toàn quyền quản trị hệ thống"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatCard
          variant="gold"
          title="Duyệt tài khoản"
          value="Trực tiếp"
          subtitle="Kích hoạt nhân sự & phân quyền"
          icon={<UserCheck className="w-4 h-4" />}
        />
        <StatCard
          variant="green"
          title="Realtime Sync"
          value="Sẵn sàng"
          subtitle="WebSocket & Supabase live"
          icon={<Sparkles className="w-4 h-4" />}
        />
        <StatCard
          variant="purple"
          title="Bảo mật API"
          value="Khép kín"
          subtitle="RLS & Throttling kích hoạt"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
      </div>

      {/* Quick Access Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/app/notifications">
          <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                  Trung tâm Thông báo
                </h4>
                <p className="text-xs text-[#64748B]">
                  Sự kiện task, leave, attendance, finance và chat.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#4F75FF] group-hover:translate-x-1 transition-all" />
          </Card>
        </Link>

        <Link href="/app/chat">
          <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                  Kênh Chat Nội bộ & Dự án
                </h4>
                <p className="text-xs text-[#64748B]">
                  Trao đổi trực tiếp và xác thực quyền phòng chat realtime.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#4F75FF] group-hover:translate-x-1 transition-all" />
          </Card>
        </Link>
      </div>

      {/* Feature Navigation Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
            Phân hệ Quản trị Nhanh
          </h3>
          <Badge variant="outline" size="sm">
            6 Phân hệ
          </Badge>
        </div>

        <QuickActionGrid items={quickActions} columns={3} />
      </div>
    </div>
  );
}
