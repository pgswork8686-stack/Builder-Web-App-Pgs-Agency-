"use client";

import React from "react";
import Link from "next/link";
import {
  FolderKanban,
  CreditCard,
  FileText,
  MessageSquare,
  Bell,
  ShieldCheck,
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

export default function ClientDashboardPage() {
  const quickActions: QuickActionItem[] = [
    {
      title: "Dự án hợp tác",
      description:
        "Theo dõi tiến độ, xem sản phẩm bàn giao và nghiệm thu dự án.",
      href: "/app/client/projects",
      icon: <FolderKanban className="w-5 h-5" />,
      badge: "Dự án",
      highlight: true,
    },
    {
      title: "Hợp đồng dịch vụ",
      description:
        "Xem chi tiết điều khoản, thời hạn và phạm vi dịch vụ đã ký kết.",
      href: "/app/client/contracts",
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      title: "Hóa đơn & Thanh toán",
      description:
        "Tra cứu hóa đơn định kỳ, số tiền cần thanh toán và lịch sử giao dịch.",
      href: "/app/client/invoices",
      icon: <FileText className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cổng thông tin Khách hàng (Client Portal)"
        description="Theo dõi chất lượng, tiến độ thực hiện và bàn giao sản phẩm từ PGS Agency."
        badge="Client Portal"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          variant="blue"
          title="Vai trò tài khoản"
          value="Khách hàng"
          subtitle="Quyền xem dự án của đối tác"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          variant="green"
          title="Trạng thái xác thực"
          value="Đang hoạt động"
          subtitle="Tài khoản đối tác bảo mật"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          variant="purple"
          title="Hỗ trợ dự án"
          value="24/7 Sẵn sàng"
          subtitle="Kết nối trực tiếp qua kênh Chat"
          icon={<Sparkles className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/app/notifications">
          <Card className="p-5 hover:border-[#4F75FF]/40 transition-all flex items-center justify-between group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#4F75FF] transition-colors">
                  Thông báo Dự án
                </h4>
                <p className="text-xs text-[#64748B]">
                  Nhận tin tức bàn giao task, hóa đơn mới và tin nhắn.
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
                  Kênh Chat Dự án
                </h4>
                <p className="text-xs text-[#64748B]">
                  Trao đổi trực tiếp với Account & Team thực hiện dự án.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#4F75FF] group-hover:translate-x-1 transition-all" />
          </Card>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
            Khu vực Dịch vụ
          </h3>
          <Badge variant="outline" size="sm">
            3 Phân hệ
          </Badge>
        </div>
        <QuickActionGrid items={quickActions} columns={3} />
      </div>
    </div>
  );
}
