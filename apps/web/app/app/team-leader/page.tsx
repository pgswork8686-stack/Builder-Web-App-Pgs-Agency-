"use client";

import React from "react";
import Link from "next/link";
import {
  UserCheck,
  ShieldCheck,
  Activity,
  LogOut,
  Bell,
  MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/phase7/notification-bell";

export default function TeamLeaderDashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      <header className="h-16 border-b border-[#151516] bg-[#0E0E0F]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FFC400] text-black font-black flex items-center justify-center text-sm">
            P
          </div>
          <span className="font-bold text-base tracking-wide text-white">
            PGS HUB{" "}
            <span className="text-[#FFC400] font-normal">
              | Team Leader Workspace
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Trưởng nhóm (Team Leader)</span>
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

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        <div className="border-b border-[#151516] pb-6">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Góc làm việc Trưởng nhóm
          </h1>
          <p className="mt-1 text-sm text-[#606060]">
            Quản lý đội ngũ nhân sự, giao nhiệm vụ và kiểm soát chất lượng dự
            án.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Vai trò của bạn
              </span>
              <UserCheck className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Trưởng nhóm
            </div>
            <div className="text-xs text-[#606060]">
              Quyền quản lý nhân sự & dự án của nhóm
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Trạng thái tài khoản
              </span>
              <ShieldCheck className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Đang hoạt động
            </div>
            <div className="text-xs text-emerald-400">
              Tài khoản đã được phê duyệt
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Môi trường
              </span>
              <Activity className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Bật an toàn
            </div>
            <div className="text-xs text-emerald-400">
              Không có cảnh báo bảo mật
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/app/notifications"
            className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/40 transition-all space-y-2 group"
          >
            <Bell className="w-5 h-5 text-[#FFC400]" />
            <h3 className="text-sm font-bold text-white group-hover:text-[#FFC400]">
              Thông báo
            </h3>
            <p className="text-xs text-[#606060]">
              Theo dõi task, bình luận, leave, attendance và cập nhật dự án.
            </p>
          </Link>

          <Link
            href="/app/chat"
            className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/40 transition-all space-y-2 group"
          >
            <MessageCircle className="w-5 h-5 text-[#FFC400]" />
            <h3 className="text-sm font-bold text-white group-hover:text-[#FFC400]">
              Chat
            </h3>
            <p className="text-xs text-[#606060]">
              Trao đổi nội bộ và project chat theo membership được xác thực.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
