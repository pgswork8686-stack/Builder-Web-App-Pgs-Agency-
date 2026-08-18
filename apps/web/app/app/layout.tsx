"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { getMe, type AccountPayload } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell/app-shell";

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
  const [user, setUser] = useState<import("@/lib/api/auth").UserPayload | null>(
    null,
  );
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
        setUser(me.user);
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
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] text-[#0F172A]">
        <div className="rounded-2xl border border-[#EDF2F7] bg-white p-8 text-center shadow-lg">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4F75FF]" />
          <p className="mt-4 text-xs font-medium text-[#64748B]">
            Đang kiểm tra quyền truy cập...
          </p>
          {error ? (
            <p className="mt-3 max-w-md text-xs text-red-600 font-semibold">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FC] p-6 text-[#0F172A]">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-base font-extrabold text-[#0F172A]">
            Không có quyền truy cập
          </h1>
          <p className="mt-2 text-xs text-[#64748B]">
            Bạn đang được chuyển về workspace đúng vai trò.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell account={account} user={user}>
      {children}
    </AppShell>
  );
}
