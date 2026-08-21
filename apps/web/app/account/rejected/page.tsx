"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { XCircle, LogOut, Mail, AlertTriangle } from "lucide-react";
import { getMe } from "@/lib/api/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AccountRejectedPage() {
  const router = useRouter();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const fetchReason = async () => {
      try {
        const me = await getMe();
        if (me.account.rejectionReason) {
          setRejectionReason(me.account.rejectionReason);
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
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-[#0F172A] p-6 relative">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-[#EDF2F7]">
        {/* Status Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-red-600 shadow-xs">
          <XCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <Badge variant="danger" size="md">
            Trạng thái: Bị từ chối
          </Badge>
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
            Tài khoản bị từ chối
          </h2>
        </div>

        <div className="text-left space-y-2 bg-[#FEF2F2] p-4 rounded-xl border border-[#FEE2E2]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Lý do từ chối:</span>
          </div>
          <p className="text-xs text-red-800 leading-relaxed">
            {rejectionReason ||
              "Yêu cầu đăng ký tài khoản không phù hợp với quy định của PGS Agency hoặc thông tin chưa đủ điều kiện phê duyệt."}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <a
            href="mailto:admin@pgsagency.com"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] font-bold text-xs hover:bg-[#F8FAFC] transition-colors"
          >
            <Mail className="w-4 h-4 text-[#4F75FF]" />
            <span>Liên hệ Quản trị viên</span>
          </a>

          <Button
            variant="danger"
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
      </Card>
    </div>
  );
}
