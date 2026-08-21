"use client";

import React, { useEffect, useState } from "react";
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
  UserCheck,
  Calendar,
  HelpCircle,
  FolderOpen,
  ChevronRight,
  Clock,
  Receipt,
} from "lucide-react";
import { getMe, type UserPayload } from "@/lib/api/auth";
import { projectsApi, type Project } from "@/lib/api/projects";
import { financeApi } from "@/lib/api/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientDashboardPage() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, projRes, contRes, invRes] = await Promise.allSettled([
          getMe(),
          projectsApi.getClientProjects(1, 10),
          financeApi.getContracts(),
          financeApi.getInvoices(),
        ]);

        if (meRes.status === "fulfilled") setUser(meRes.value.user);
        if (projRes.status === "fulfilled")
          setProjects(projRes.value.items || []);
        if (contRes.status === "fulfilled")
          setContracts(contRes.value?.items || []);
        if (invRes.status === "fulfilled")
          setInvoices(invRes.value?.items || []);
      } catch {
        // Safe load
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const companyName = user?.fullName || "Quý Khách hàng";
  const activeProjectsCount = projects.length;

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#24304A] tracking-tight">
            Chào {companyName}
          </h1>
          <p className="text-xs sm:text-sm text-[#7C879D] mt-1">
            Cổng thông tin khách hàng, theo dõi tiến độ thực hiện và bàn giao
            sản phẩm từ PGS Agency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/app/client/support">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<HelpCircle className="w-4 h-4" />}
            >
              Yêu cầu hỗ trợ
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Hero + 2 Mini KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Banner */}
        <div className="lg:col-span-6 rounded-3xl bg-[#EEF2FF] border border-[#E0EAFF] p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#24304A] tracking-tight">
              {activeProjectsCount > 0
                ? `Dự án đang triển khai (${activeProjectsCount})`
                : "Chưa có dự án nào đang triển khai"}
            </h2>
            <p className="text-xs sm:text-sm text-[#5D87FF] leading-relaxed">
              Theo dõi các mốc hoàn thành, kiểm duyệt tài liệu nghiệm thu và hóa
              đơn thanh toán trực tiếp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <Link href="/app/client/projects">
              <Button variant="primary" size="sm">
                Xem chi tiết dự án
              </Button>
            </Link>
            <Link href="/app/client/invoices">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Receipt className="w-4 h-4" />}
              >
                Xem hóa đơn
              </Button>
            </Link>
          </div>
        </div>

        {/* Tiến độ tổng */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Tiến độ tổng
            </span>
            <div className="text-3xl font-black text-[#24304A] mt-2">
              {activeProjectsCount > 0 ? "100%" : "—"}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#13DEB9] flex items-center gap-1 mt-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Đúng tiến độ cam kết
          </span>
        </div>

        {/* Công nợ còn lại */}
        <div className="lg:col-span-3 rounded-3xl bg-white border border-[#EDF2F7] p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#7C879D]">
              Công nợ còn lại
            </span>
            <div className="text-2xl font-black text-[#24304A] mt-2">0 ₫</div>
          </div>
          <span className="text-xs font-bold text-[#13DEB9] mt-4">
            Đã hoàn thành nghĩa vụ
          </span>
        </div>
      </div>

      {/* 5-Metric Row: Dự án, Chờ duyệt, Tài liệu, Cuộc họp, Ticket */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Link href="/app/client/projects">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <span className="text-xs font-bold text-[#7C879D]">Dự án</span>
            <p className="text-2xl font-black text-[#24304A] mt-2">
              {activeProjectsCount}
            </p>
          </Card>
        </Link>

        <Link href="/app/client/approvals">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <span className="text-xs font-bold text-[#7C879D]">Chờ duyệt</span>
            <p className="text-xs font-semibold text-[#7C879D] mt-3">
              Theo dự án
            </p>
          </Card>
        </Link>

        <Link href="/app/client/documents">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <span className="text-xs font-bold text-[#7C879D]">Tài liệu</span>
            <p className="text-xs font-semibold text-[#7C879D] mt-3">
              Theo dự án
            </p>
          </Card>
        </Link>

        <Link href="/app/client/meetings">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group">
            <span className="text-xs font-bold text-[#7C879D]">Cuộc họp</span>
            <p className="text-xs font-semibold text-[#7C879D] mt-3">
              Theo lịch
            </p>
          </Card>
        </Link>

        <Link href="/app/client/support">
          <Card className="p-4 hover:border-[#5D87FF]/40 transition-all group col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-[#7C879D]">Hỗ trợ</span>
            <p className="text-xs font-semibold text-[#7C879D] mt-3">
              Chat nội bộ
            </p>
          </Card>
        </Link>
      </div>

      {/* Dual Section: Tiến độ dự án & Sản phẩm chờ duyệt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
              Tiến độ dự án
            </h3>
            <Link
              href="/app/client/projects"
              className="text-xs font-bold text-[#5D87FF] hover:underline flex items-center gap-1"
            >
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card className="p-6 text-center">
              <EmptyState
                icon={<FolderKanban className="w-8 h-8 text-[#7C879D]" />}
                title="Chưa có dự án hợp tác"
                description="Các dự án triển khai giữa doanh nghiệp và PGS Agency sẽ hiển thị tại đây."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[#EDF2F7]">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-[#F6F8FC] transition-colors"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-[#5D87FF]">
                      {p.projectCode}
                    </span>
                    <h4 className="text-xs font-bold text-[#24304A]">
                      {p.name}
                    </h4>
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
              Sản phẩm chờ duyệt
            </h3>
            <Badge variant="gold" size="sm">
              0 ấn phẩm
            </Badge>
          </div>

          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Hiện tại không có ấn phẩm hoặc tài liệu nào đang chờ quý khách
              nghiệm thu.
            </p>
          </Card>
        </div>
      </div>

      {/* Dual Section: Tài liệu bàn giao & Hỗ trợ và thanh toán */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Tài liệu bàn giao
          </h3>
          <Card className="p-4">
            <p className="text-xs text-[#7C879D]">
              Chưa có tài liệu đính kèm nào được tải lên.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-3">
          <h3 className="text-base font-extrabold text-[#24304A] tracking-tight">
            Hỗ trợ và thanh toán
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/app/client/invoices"
              className="p-3 rounded-2xl bg-[#EEF2FF] border border-[#E0EAFF] text-center block"
            >
              <span className="text-xs font-bold text-[#5D87FF]">
                Tra cứu hóa đơn
              </span>
            </Link>
            <Link
              href="/app/client/support"
              className="p-3 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] text-center block"
            >
              <span className="text-xs font-bold text-[#24304A]">
                Gửi Ticket hỗ trợ
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
