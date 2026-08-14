"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMe } from "@/lib/api/auth";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AuthResolvePage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState(
    "Đang xác thực thông tin tài khoản...",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const resolveUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || !session.user) {
          router.replace("/auth/login");
          return;
        }

        setStatusText("Đang kiểm tra trạng thái phê duyệt từ backend...");

        // Fetch authoritative auth/profile state from NestJS backend
        const response = await getMe();
        const { status, role } = response.account;

        if (status === "rejected") {
          router.replace("/account/rejected");
          return;
        }

        if (status === "pending") {
          router.replace("/account/pending");
          return;
        }

        if (status === "active") {
          // Active status -> Redirect to role dashboard
          const roleRoutes: Record<string, string> = {
            admin: "/app/admin",
            team_leader: "/app/team-leader",
            employee: "/app/employee",
            accountant: "/app/accountant",
            client: "/app/client",
          };

          const targetRoute = role && roleRoutes[role];
          if (targetRoute) {
            router.replace(targetRoute);
          } else {
            setErrorMsg(
              "Tài khoản của bạn đã được kích hoạt nhưng chưa được chỉ định vai trò hợp lệ. Vui lòng liên hệ Admin.",
            );
          }
          return;
        }

        setErrorMsg("Trạng thái tài khoản không xác định.");
      } catch (err: any) {
        console.error("Resolve error:", err);
        setErrorMsg(err.message || "Lỗi kết nối tới máy chủ xác thực.");
      }
    };

    resolveUser();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-[#0F172A] p-6">
      <Card className="flex flex-col items-center gap-4 p-8 text-center max-w-md w-full shadow-lg border-[#EDF2F7]">
        {errorMsg ? (
          <>
            <h3 className="text-base font-extrabold text-red-600">
              LỖI XÁC THỰC
            </h3>
            <p className="text-xs text-[#64748B]">{errorMsg}</p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                const supabase = createClient();
                supabase.auth
                  .signOut()
                  .then(() => router.replace("/auth/login"));
              }}
              className="mt-2"
            >
              Đăng xuất và thử lại
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin" />
            <h3 className="text-base font-extrabold text-[#0F172A]">PGS HUB</h3>
            <p className="text-xs text-[#64748B]">{statusText}</p>
          </>
        )}
      </Card>
    </div>
  );
}
