"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";

export default function AccountPendingPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    router.push("/auth/resolve");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070707] text-[#FFF8E6] p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FFC400]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#0E0E0F] border border-[#151516] p-8 rounded-2xl shadow-2xl text-center space-y-6">
        {/* Status Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FFC400]/10 border border-[#FFC400]/30 flex items-center justify-center text-[#FFC400] shadow-[0_0_30px_rgba(255,196,0,0.15)]">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFC400]/10 border border-[#FFC400]/30 text-[#FFC400] text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-[#FFC400] animate-ping" />
            Trạng thái: Chờ duyệt
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Tài khoản đang chờ phê duyệt
          </h2>
        </div>

        <p className="text-sm text-[#FFF8E6]/70 leading-relaxed bg-[#151516]/60 p-4 rounded-xl border border-[#151516]">
          Tài khoản của bạn đã được khởi tạo thành công và đang chờ Quản trị
          viên (Admin) kiểm tra và phân quyền truy cập. Vui lòng thử lại sau
          hoặc liên hệ bộ phận hỗ trợ.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#FFC400] to-[#CFA63E] hover:brightness-110 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,196,0,0.2)] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${checking ? "animate-spin" : ""}`}
            />
            <span>Kểm tra lại trạng thái</span>
          </button>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-[#606060] hover:text-white font-medium text-sm transition-colors border border-[#151516] cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
          </button>
        </div>

        <div className="pt-4 border-t border-[#151516] flex items-center justify-center gap-2 text-xs text-[#606060]">
          <ShieldAlert className="w-3.5 h-3.5 text-[#FFC400]" />
          <span>PGS Agency Enterprise Operating System</span>
        </div>
      </div>
    </div>
  );
}
