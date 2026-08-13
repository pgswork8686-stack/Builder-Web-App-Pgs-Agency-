"use client";

import React from "react";
import Link from "next/link";
import { UserCheck, ShieldCheck, Activity, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountantDashboardPage() {
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
              | Accountant Workspace
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151516] border border-[#FFC400]/20 text-xs text-[#FFC400]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Kế toán (Accountant)</span>
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
            Góc làm việc Kế toán
          </h1>
          <p className="mt-1 text-sm text-[#606060]">
            Quản lý tài chính, giao dịch hợp đồng, kiểm soát chi phí doanh
            nghiệp.
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
              Kế toán viên
            </div>
            <div className="text-xs text-[#606060]">
              Quyền quản lý dữ liệu tài chính & hóa đơn
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
                Cơ sở dữ liệu
              </span>
              <Activity className="w-4 h-4 text-[#FFC400]" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              Kết nối an toàn
            </div>
            <div className="text-xs text-emerald-400">
              Bảo vệ SSL & RLS Enforced
            </div>
          </div>
        </div>

        {/* Finance Quick Links Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Quản lý Tài chính</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Link
              href="/app/accountant/finance"
              className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/40 transition-all space-y-2 group"
            >
              <h4 className="text-sm font-bold text-white group-hover:text-[#FFC400] transition-colors">
                Tổng quan tài chính
              </h4>
              <p className="text-xs text-[#606060]">
                Xem doanh thu thực tế, nợ quá hạn và các thay đổi tài chính.
              </p>
            </Link>

            <Link
              href="/app/accountant/finance/contracts"
              className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/40 transition-all space-y-2 group"
            >
              <h4 className="text-sm font-bold text-white group-hover:text-[#FFC400] transition-colors">
                Danh sách hợp đồng
              </h4>
              <p className="text-xs text-[#606060]">
                Tạo mới, chỉnh sửa nháp và quản lý vòng đời hợp đồng.
              </p>
            </Link>

            <Link
              href="/app/accountant/finance/invoices"
              className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] hover:border-[#FFC400]/40 transition-all space-y-2 group"
            >
              <h4 className="text-sm font-bold text-white group-hover:text-[#FFC400] transition-colors">
                Danh sách hóa đơn
              </h4>
              <p className="text-xs text-[#606060]">
                Ghi nhận thanh toán, đánh dấu quá hạn, phát hành hóa đơn.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
