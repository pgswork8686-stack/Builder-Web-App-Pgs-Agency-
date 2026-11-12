"use client";

import { statusLabel } from "@/lib/labels";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  User,
  Shield,
  ChevronDown,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/phase7/notification-bell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "./role-navigation";
import type { AccountPayload, UserPayload } from "@/lib/api/auth";

export interface TopbarProps {
  account: AccountPayload;
  user?: UserPayload | null;
  onOpenMobileSidebar: () => void;
}

export function Topbar({ account, user, onOpenMobileSidebar }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // Center title resolution matching module boundaries

  const roleTitle = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName =
    user?.fullName ||
    user?.email?.split("@")[0] ||
    roleTitle.split("(")[0].trim();

  return (
    <header className="h-16 border-b border-[#E7E9F0] bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left side: Hamburger (mobile/tablet) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-[#475569] hover:text-[#202333] hover:bg-[#F8F9FC] transition-colors cursor-pointer"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* V2: không lặp tiêu đề trang ở thanh trên (tiêu đề nằm trong trang). */}

      {/* Right side: Chat, Notification Bell, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Chat Link */}
        <Link
          href="/app/chat"
          className="relative min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-[#475569] hover:text-[#202333] hover:bg-[#F2EEFF] transition-all cursor-pointer"
          title="Tin nhắn nội bộ"
          aria-label="Tin nhắn nội bộ"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>

        {/* Notifications */}
        <NotificationBell />

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 min-h-11 rounded-full hover:bg-[#F8F9FC] border border-transparent hover:border-[#E7E9F0] transition-all cursor-pointer select-none"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Avatar src={user?.avatarUrl} name={displayName} size="sm" />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-[#202333] tracking-tight truncate max-w-[130px]">
                {displayName}
              </span>
              <span className="text-xs text-[#475569] font-medium truncate max-w-[130px]">
                {account.role
                  ? ROLE_LABELS[account.role].split("(")[0].trim()
                  : "Người dùng"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#475569] hidden sm:block mr-1" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-[#E7E9F0] p-2 text-[#202333] shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-[#E7E9F0]">
                <p className="text-xs font-bold text-[#202333] tracking-tight truncate">
                  {displayName}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="brand" size="sm">
                    {account.role
                      ? statusLabel(account.role)
                      : "Chưa phân quyền"}
                  </Badge>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <Link
                  href="/app/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#202333] hover:bg-[#F2EEFF] transition-colors"
                >
                  <User className="w-4 h-4 text-[#475569]" />
                  <span>Hồ sơ cá nhân</span>
                </Link>

                {account.role === "admin" && (
                  <Link
                    href="/app/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#202333] hover:bg-[#F2EEFF] transition-colors"
                  >
                    <Shield className="w-4 h-4 text-[#7257F5]" />
                    <span>Bảng điều khiển Admin</span>
                  </Link>
                )}

                <Link
                  href="/auth/update-password"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#202333] hover:bg-[#F2EEFF] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[#475569]" />
                  <span>Đổi mật khẩu</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-[#E7E9F0]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#FF785A] hover:bg-rose-50 transition-colors cursor-pointer font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
