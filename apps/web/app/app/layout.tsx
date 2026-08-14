"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { getMe, type AccountPayload } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/client";

const roleHome: Record<NonNullable<AccountPayload["role"]>, string> = {
  admin: "/app/admin",
  team_leader: "/app/team-leader",
  employee: "/app/employee",
  accountant: "/app/accountant",
  client: "/app/client",
};

const sharedPrefixes = ["/app/notifications", "/app/chat", "/app/profile"];

const rolePrefixes: Record<NonNullable<AccountPayload["role"]>, string[]> = {
  admin: ["/app"],
  team_leader: [
    "/app/team-leader",
    "/app/projects",
    "/app/attendance",
    "/app/leave",
    ...sharedPrefixes,
  ],
  employee: [
    "/app/employee",
    "/app/projects",
    "/app/attendance",
    "/app/leave",
    ...sharedPrefixes,
  ],
  accountant: ["/app/accountant", "/app/projects", ...sharedPrefixes],
  client: ["/app/client", ...sharedPrefixes],
};

function isAllowedPath(
  pathname: string,
  role: NonNullable<AccountPayload["role"]>,
) {
  if (pathname === "/app") return true;
  return rolePrefixes[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const currentRole = account?.role ?? null;
  const allowed = useMemo(() => {
    if (!currentRole) return false;
    return isAllowedPath(pathname, currentRole);
  }, [currentRole, pathname]);

  useEffect(() => {
    let disposed = false;

    const verify = async () => {
      setChecking(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace("/auth/login");
          return;
        }

        const me = await getMe();
        if (disposed) return;

        if (me.account.status === "pending") {
          router.replace("/account/pending");
          return;
        }
        if (me.account.status === "rejected") {
          router.replace("/account/rejected");
          return;
        }
        if (me.account.status !== "active" || !me.account.role) {
          setError(
            "Tài khoản chưa có vai trò hợp lệ. Vui lòng liên hệ quản trị viên.",
          );
          return;
        }

        setAccount(me.account);
        if (!isAllowedPath(pathname, me.account.role)) {
          router.replace(roleHome[me.account.role]);
        }
      } catch (err) {
        if (disposed) return;
        setError(
          err instanceof Error
            ? err.message
            : "Không xác thực được phiên đăng nhập.",
        );
      } finally {
        if (!disposed) setChecking(false);
      }
    };

    void verify();

    return () => {
      disposed = true;
    };
  }, [pathname, router]);

  if (checking || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070707] text-[#FFF8E6]">
        <div className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-8 text-center shadow-2xl">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#FFC400]" />
          <p className="mt-4 text-sm text-[#606060]">
            Đang kiểm tra quyền truy cập...
          </p>
          {error ? (
            <p className="mt-3 max-w-md text-sm text-red-300">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070707] p-6 text-[#FFF8E6]">
        <div className="max-w-md rounded-3xl border border-red-500/20 bg-[#0E0E0F] p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-4 text-xl font-black text-white">
            Không có quyền truy cập
          </h1>
          <p className="mt-2 text-sm text-[#606060]">
            Bạn đang được chuyển về workspace đúng vai trò.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
