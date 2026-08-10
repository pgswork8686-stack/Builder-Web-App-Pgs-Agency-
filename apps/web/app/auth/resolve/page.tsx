"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthResolvePage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState(
    "Đang xác thực thông tin tài khoản...",
  );

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

        const user = session.user;
        setStatusText("Đang kiểm tra quyền truy cập...");

        // Try fetching user profile from DB table 'profiles'
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();

        let role = profile?.role || user.user_metadata?.role || "employee";
        let status = profile?.status || user.user_metadata?.status || "pending";

        // Normalize role string format (e.g. team_leader -> team-leader)
        if (role === "team_leader") role = "team-leader";

        if (status === "rejected") {
          router.replace("/account/rejected");
          return;
        }

        if (status === "pending") {
          router.replace("/account/pending");
          return;
        }

        // Active status -> Redirect to role dashboard
        const roleRoutes: Record<string, string> = {
          admin: "/app/admin",
          "team-leader": "/app/team-leader",
          employee: "/app/employee",
          accountant: "/app/accountant",
          client: "/app/client",
        };

        const targetRoute = roleRoutes[role] || "/app/employee";
        router.replace(targetRoute);
      } catch (err) {
        console.error("Resolve error:", err);
        router.replace("/account/pending");
      }
    };

    resolveUser();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070707] text-white p-6">
      <div className="flex flex-col items-center gap-4 p-8 bg-[#0E0E0F] border border-[#151516] rounded-2xl shadow-2xl text-center max-w-sm w-full">
        <Loader2 className="w-10 h-10 text-[#FFC400] animate-spin" />
        <h3 className="text-lg font-bold text-white">PGS HUB</h3>
        <p className="text-xs text-[#FFF8E6]/70">{statusText}</p>
      </div>
    </div>
  );
}
