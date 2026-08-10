"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { XCircle, LogOut, Mail, AlertTriangle } from "lucide-react";

export default function AccountRejectedPage() {
  const router = useRouter();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchReason = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("rejection_reason")
            .eq("id", session.user.id)
            .single();

          if (profile?.rejection_reason) {
            setRejectionReason(profile.rejection_reason);
          }
        }
      } catch (err) {
        console.error("Failed to load rejection reason", err);
      }
    };
    fetchReason();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070707] text-[#FFF8E6] p-6 relative overflow-hidden">
      {/* Background red glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#0E0E0F] border border-[#151516] p-8 rounded-2xl shadow-2xl text-center space-y-6">
        {/* Status Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
          <XCircle className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Trạng thái: Bị từ chối
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Tài khoản bị từ chối
          </h2>
        </div>

        <div className="text-left space-y-3 bg-[#151516]/80 p-4 rounded-xl border border-[#151516]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Lý do từ chối:</span>
          </div>
          <p className="text-sm text-[#FFF8E6]/80 leading-relaxed">
            {rejectionReason ||
              "Yêu cầu đăng ký tài khoản không phù hợp với quy định của PGS Agency hoặc thông tin chưa đủ điều kiện phê duyệt."}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <a
            href="mailto:admin@pgsagency.com"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-white font-medium text-sm transition-colors border border-[#151516]"
          >
            <Mail className="w-4 h-4 text-[#FFC400]" />
            <span>Liên hệ Quản trị viên</span>
          </a>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-950/40 hover:bg-red-950/70 text-red-300 font-medium text-sm transition-colors border border-red-500/20 cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
