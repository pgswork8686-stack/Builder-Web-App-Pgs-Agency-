"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-[#0F172A] p-6 relative">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-[#EDF2F7]">
        {/* Status Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FEF9C3] border border-[#FDE047] flex items-center justify-center text-[#CA8A04] shadow-xs">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <Badge variant="gold" size="md">
            Trạng thái: Chờ duyệt
          </Badge>
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
            Tài khoản đang chờ phê duyệt
          </h2>
        </div>

        <p className="text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#EDF2F7]">
          Tài khoản của bạn đã được khởi tạo thành công và đang chờ Quản trị
          viên (Admin) phê duyệt và phân quyền truy cập. Vui lòng thử lại sau
          hoặc liên hệ bộ phận quản lý.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={handleCheckStatus}
            disabled={checking}
            isLoading={checking}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="w-full"
          >
            Kiểm tra lại trạng thái
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={handleLogout}
            disabled={loggingOut}
            isLoading={loggingOut}
            leftIcon={<LogOut className="w-4 h-4" />}
            className="w-full"
          >
            Đăng xuất
          </Button>
        </div>

        <div className="pt-4 border-t border-[#EDF2F7] flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
          <ShieldAlert className="w-3.5 h-3.5 text-[#4F75FF]" />
          <span>PGS Agency Enterprise Operating System</span>
        </div>
      </Card>
    </div>
  );
}
