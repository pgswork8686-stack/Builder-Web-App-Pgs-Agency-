"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  LogOut,
  User,
  Shield,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/phase7/notification-bell";
import { Breadcrumb } from "./breadcrumb";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "./role-navigation";
import type { AccountPayload } from "@/lib/api/auth";

export interface TopbarProps {
  account: AccountPayload;
  onOpenMobileSidebar: () => void;
}

export function Topbar({ account, onOpenMobileSidebar }: TopbarProps) {
  const router = useRouter();
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

  const roleTitle = account.role ? ROLE_LABELS[account.role] : "Người dùng";

  return (
    <header className="h-16 border-b border-[#EDF2F7] bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Left side: Hamburger (mobile/tablet) + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block min-w-0">
          <Breadcrumb />
        </div>
      </div>

      {/* Right side: Search, Notification Bell, User Menu */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick Search Trigger */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F1F5F9] border border-transparent text-xs text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Tìm kiếm toàn hệ thống...</span>
          <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white text-[10px] text-[#64748B] font-mono shadow-xs">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-[#F1F5F9] border border-transparent hover:border-[#E2E8F0] transition-all cursor-pointer select-none"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Avatar name="User" size="sm" />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-[#0F172A] tracking-tight truncate max-w-[130px]">
                {roleTitle.split("(")[0].trim()}
              </span>
              <span className="text-[10px] text-[#64748B]">Trực tuyến</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden sm:block mr-1" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#E2E8F0] p-2 text-[#0F172A] shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-[#EDF2F7]">
                <p className="text-xs font-bold text-[#0F172A] tracking-tight truncate">
                  Tài khoản doanh nghiệp
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="gold" size="sm">
                    {account.role || "Chưa phân quyền"}
                  </Badge>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <Link
                  href="/app/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  <User className="w-4 h-4 text-[#64748B]" />
                  <span>Hồ sơ cá nhân</span>
                </Link>

                {account.role === "admin" && (
                  <Link
                    href="/app/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <Shield className="w-4 h-4 text-[#4F75FF]" />
                    <span>Bảng điều khiển Admin</span>
                  </Link>
                )}

                <Link
                  href="/auth/update-password"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[#64748B]" />
                  <span>Đổi mật khẩu</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-[#EDF2F7]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer font-medium"
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
