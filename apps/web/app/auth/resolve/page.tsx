"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMe } from "@/lib/api/auth";
import { Loader2 } from "lucide-react";

export default function AuthResolvePage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState(
    "Đang xác thực thông tin tài khoản..."
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
            setErrorMsg("Tài khoản của bạn đã được kích hoạt nhưng chưa được chỉ định vai trò hợp lệ. Vui lòng liên hệ Admin.");
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070707] text-white p-6">
      <div className="flex flex-col items-center gap-4 p-8 bg-[#0E0E0F] border border-[#151516] rounded-2xl shadow-2xl text-center max-w-md w-full">
        {errorMsg ? (
          <>
            <h3 className="text-lg font-bold text-red-500">LỖI XÁC THỰC</h3>
            <p className="text-sm text-[#FFF8E6]/80">{errorMsg}</p>
            <button
              onClick={() => {
                const supabase = createClient();
                supabase.auth.signOut().then(() => router.replace("/auth/login"));
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
            >
              Đăng xuất và thử lại
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-[#FFC400] animate-spin" />
            <h3 className="text-lg font-bold text-white">PGS HUB</h3>
            <p className="text-xs text-[#FFF8E6]/70">{statusText}</p>
          </>
        )}
      </div>
    </div>
  );
}
