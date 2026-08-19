"use client";

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

  // Center title resolution matching Figma
  const getCenterTitle = () => {
    if (pathname === "/app/admin") return "Admin Dashboard";
    if (pathname === "/app/team-leader") return "Manager Dashboard";
    if (pathname === "/app/employee") return "Employee Dashboard";
    if (pathname === "/app/accountant") return "Accounting Dashboard";
    if (pathname === "/app/client") return "Client Dashboard";
    if (pathname.includes("/projects")) return "Quản lý Dự án";
    if (pathname.includes("/tasks") || pathname.includes("/kanban"))
      return "Công việc & Kanban";
    if (pathname.includes("/attendance")) return "Quản lý Chấm công";
    if (pathname.includes("/leave")) return "Quản lý Nghỉ phép";
    if (pathname.includes("/finance")) return "Quản lý Tài chính";
    if (pathname.includes("/clients")) return "Quản lý Khách hàng";
    if (
      pathname.includes("/people") ||
      pathname.includes("/organization") ||
      pathname.includes("/departments") ||
      pathname.includes("/teams")
    )
      return "Quản lý Nhân sự & Cơ cấu";
    if (pathname.includes("/documents")) return "Thư viện Tài liệu PGS";
    if (pathname.includes("/reports")) return "Báo cáo Tổng hợp";
    if (pathname.includes("/chat")) return "Tin nhắn Nội bộ";
    if (pathname.includes("/notifications")) return "Trung tâm Thông báo";
    if (pathname.includes("/settings")) return "Cài đặt Hệ thống";
    return "PGS Hub Workspace";
  };

  const roleTitle = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName =
    user?.fullName ||
    user?.email?.split("@")[0] ||
    roleTitle.split("(")[0].trim();

  return (
    <header className="h-[78px] border-b border-[#EDF2F7] bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Left side: Hamburger (mobile/tablet) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC] transition-colors cursor-pointer"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Center: Current Dashboard / Page Name */}
      <div className="flex items-center justify-center">
        <span className="font-bold text-sm text-[#24304A] tracking-tight">
          {getCenterTitle()}
        </span>
      </div>

      {/* Right side: Chat, Notification Bell, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Chat Link */}
        <Link
          href="/app/chat"
          className="relative p-2 rounded-xl text-[#7C879D] hover:text-[#5D87FF] hover:bg-[#EEF2FF] transition-all cursor-pointer"
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
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-[#F6F8FC] border border-transparent hover:border-[#EDF2F7] transition-all cursor-pointer select-none"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <Avatar name={displayName} size="sm" />
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-[#24304A] tracking-tight truncate max-w-[130px]">
                {displayName}
              </span>
              <span className="text-[10px] text-[#7C879D] font-medium truncate max-w-[130px]">
                {account.role
                  ? ROLE_LABELS[account.role].split("(")[0].trim()
                  : "Người dùng"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#7C879D] hidden sm:block mr-1" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#EDF2F7] p-2 text-[#24304A] shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-[#EDF2F7]">
                <p className="text-xs font-bold text-[#24304A] tracking-tight truncate">
                  {displayName}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="blue" size="sm">
                    {account.role
                      ? account.role.toUpperCase()
                      : "CHƯA PHÂN QUYỀN"}
                  </Badge>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <Link
                  href="/app/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#24304A] hover:bg-[#F6F8FC] transition-colors"
                >
                  <User className="w-4 h-4 text-[#7C879D]" />
                  <span>Hồ sơ cá nhân</span>
                </Link>

                {account.role === "admin" && (
                  <Link
                    href="/app/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#24304A] hover:bg-[#F6F8FC] transition-colors"
                  >
                    <Shield className="w-4 h-4 text-[#5D87FF]" />
                    <span>Bảng điều khiển Admin</span>
                  </Link>
                )}

                <Link
                  href="/auth/update-password"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#24304A] hover:bg-[#F6F8FC] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[#7C879D]" />
                  <span>Đổi mật khẩu</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-[#EDF2F7]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#FA896B] hover:bg-rose-50 transition-colors cursor-pointer font-medium"
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
