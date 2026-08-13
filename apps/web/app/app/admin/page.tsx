"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  UserCheck,
  Users,
  Settings,
  Activity,
  ArrowRight,
  LogOut,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FFC400] text-black font-black flex items-center justify-center text-sm">
            P
          </div>
          <span className="font-bold text-base tracking-wide text-white">
            PGS HUB{" "}
            <span className="text-[#FFC400] font-normal">
              | Admin Workspace
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quản trị viên (Admin)</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        <div className="border-b border-[#151516] pb-6">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Bảng điều khiển Quản trị viên
          </h1>
          <p className="mt-1 text-sm text-[#606060]">
            Quản lý tài khoản người dùng, cấu hình hệ thống và phân quyền truy
            cập doanh nghiệp.
          </p>
        </div>

        {/* Feature Banner: Account Approvals */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0E0E0F] via-[#151516] to-[#0E0E0F] border border-[#FFC400]/30 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 max-w-xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFC400]/10 text-[#FFC400] text-xs font-semibold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Yêu cầu mới cần phê duyệt</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              Phê duyệt & Phân quyền tài khoản
            </h3>
            <p className="text-xs text-[#FFF8E6]/70 leading-relaxed">
              Xem danh sách nhân sự mới đăng ký, chọn vai trò thích hợp và duyệt
              cấp tài khoản vào hệ thống.
            </p>
          </div>

          <Link
            href="/app/admin/accounts/pending"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#FFC400] to-[#CFA63E] hover:brightness-110 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,196,0,0.2)] shrink-0 z-10"
          >
            <span>Đến trang phê duyệt</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Banner: Finance */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0E0E0F] via-[#151516] to-[#0E0E0F] border border-[#FFC400]/30 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 max-w-xl z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFC400]/10 text-[#FFC400] text-xs font-semibold">
              <FileText className="w-3.5 h-3.5" />
              <span>Quản lý tài chính doanh nghiệp</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              Hợp đồng, Hóa đơn & Doanh thu
            </h3>
            <p className="text-xs text-[#FFF8E6]/70 leading-relaxed">
              Theo dõi và quản lý toàn bộ hợp đồng dịch vụ, hóa đơn phát hành,
              ghi nhận thanh toán công nợ và báo cáo tổng quan.
            </p>
          </div>

          <Link
            href="/app/admin/finance"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#FFC400] to-[#CFA63E] hover:brightness-110 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,196,0,0.2)] shrink-0 z-10"
          >
            <span>Đến trang tài chính</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Real workspace claims */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Vai trò của bạn
              </span>
              <ShieldCheck className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Quản trị viên
            </div>
            <div className="text-xs text-[#606060]">
              Bạn sở hữu quyền quản trị toàn bộ cấu hình hệ thống và dữ liệu.
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Quyền hạn phê duyệt
              </span>
              <UserCheck className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Quản lý tài khoản chờ duyệt
            </div>
            <div className="text-xs text-[#606060]">
              Xét duyệt danh tính và phân quyền vai trò cho nhân sự mới đăng ký.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
