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

export default function ClientDashboardPage() {
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
            <span className="text-[#FFC400] font-normal">| Client Portal</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Khách hàng (Client)</span>
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
            Cổng thông tin Khách hàng
          </h1>
          <p className="mt-1 text-sm text-[#606060]">
            Theo dõi chất lượng, bàn giao sản phẩm của dự án của bạn từ PGS
            Agency.
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
            <div className="text-2xl font-extrabold text-white">Khách hàng</div>
            <div className="text-xs text-[#606060]">
              Quyền xem thông tin bàn giao dự án của bạn
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
              Tài khoản đối tác được xác thực
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-3">
            <div className="flex items-center justify-between text-[#606060]">
              <span className="text-xs font-semibold uppercase">
                Kết nối an toàn
              </span>
              <Activity className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">Trực tuyến</div>
            <div className="text-xs text-emerald-400">
              Bảo mật thông tin khách hàng tuyệt đối
            </div>
          </div>
        </div>

        <div className="border-t border-[#151516] pt-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Thông báo & Trao đổi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link
              href="/app/notifications"
              className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/25 transition-all space-y-2 block"
            >
              <Bell className="w-5 h-5 text-[#FFC400]" />
              <h3 className="text-base font-bold text-white group-hover:text-[#FFC400]">
                Thông báo dự án
              </h3>
              <p className="text-xs text-[#606060]">
                Theo dõi cập nhật project, hóa đơn, thanh toán và tin nhắn liên
                quan đến công ty của bạn.
              </p>
            </Link>

            <Link
              href="/app/chat"
              className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/25 transition-all space-y-2 block"
            >
              <MessageCircle className="w-5 h-5 text-[#FFC400]" />
              <h3 className="text-base font-bold text-white group-hover:text-[#FFC400]">
                Project chat
              </h3>
              <p className="text-xs text-[#606060]">
                Client chỉ tham gia project chat được server xác thực qua client
                membership.
              </p>
            </Link>
          </div>
        </div>

        <div className="border-t border-[#151516] pt-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Tài chính & Thanh toán
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Link
              href="/app/client/contracts"
              className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/25 transition-all space-y-2 block"
            >
              <h3 className="text-base font-bold text-white group-hover:text-[#FFC400]">
                Hợp đồng dịch vụ
              </h3>
              <p className="text-xs text-[#606060]">
                Tra cứu thông tin chi tiết các hợp đồng, điều khoản và thời gian
                hiệu lực đã ký kết.
              </p>
            </Link>

            <Link
              href="/app/client/invoices"
              className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/25 transition-all space-y-2 block"
            >
              <h3 className="text-base font-bold text-white group-hover:text-[#FFC400]">
                Hóa đơn & Thanh toán
              </h3>
              <p className="text-xs text-[#606060]">
                Kiểm tra các hóa đơn phát hành, số tiền cần thanh toán, dư nợ và
                lịch sử giao dịch.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
