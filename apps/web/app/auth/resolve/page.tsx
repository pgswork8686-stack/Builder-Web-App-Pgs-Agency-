"use client";

import { viError } from "@/lib/labels";

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
        setErrorMsg(viError(err, "Lỗi kết nối tới máy chủ xác thực."));
      }
    };

    resolveUser();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FC] text-[#202333] p-6">
      <Card className="flex flex-col items-center gap-4 p-8 text-center max-w-[460px] w-full rounded-3xl border-[#E7E9F0]">
        {errorMsg ? (
          <>
            <h3 className="text-base font-extrabold text-red-600">
              LỖI XÁC THỰC
            </h3>
            <p className="text-xs text-[#475569]">{errorMsg}</p>
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
            <Loader2 className="w-8 h-8 text-[#6044E8] animate-spin" />
            <h3 className="text-base font-extrabold text-[#202333]">PGS HUB</h3>
            <p className="text-xs text-[#475569]">{statusText}</p>
          </>
        )}
      </Card>
    </div>
  );
}
