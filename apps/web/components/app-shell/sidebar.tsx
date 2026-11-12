"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, HelpCircle } from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  ROLE_LABELS,
} from "./role-navigation";
import { isNavItemActive } from "./navigation-utils";
import type { AccountPayload, UserPayload } from "@/lib/api/auth";
import { Avatar } from "@/components/ui/avatar";

export interface SidebarProps {
  account: AccountPayload;
  user?: UserPayload | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** Sidebar V2: module là mục menu, các view con hiển thị thành tab trong trang (ModuleTabs). */
export function Sidebar({ account, user, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const navGroups = account.role ? getNavigationForRole(account.role) : [];
  const subtitle = account.role ? ROLE_HEADER_SUBTITLE[account.role] : "PGS Agency";
  const roleLabel = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName = user?.fullName || user?.email?.split("@")[0] || roleLabel;
  const supportHref = account.role === "client" ? "/app/client/support" : "/app/notifications";
  // Nhân viên chấm công hằng ngày → lối tắt luôn nhìn thấy (mobile-first ở /app/attendance).
  const showCheckIn = account.role === "employee";

  return (
    <aside
      aria-label="Điều hướng chính"
      className={`hidden lg:flex flex-col h-full border-r border-[#E7E9F0] bg-white text-[#202333] transition-[width] duration-200 z-20 select-none shrink-0 ${collapsed ? "w-[72px]" : "w-[240px]"}`}
    >
      <div className={`h-16 flex shrink-0 border-b border-[#E7E9F0] ${collapsed ? "flex-col items-center justify-center gap-1" : "items-center justify-between px-4"}`}>
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-9 h-9 rounded-lg bg-[#F2EEFF] p-1 flex items-center justify-center shrink-0 overflow-hidden">
            <Image src="/brand/pgs-agency-logo-transparent.png" alt="PGS Agency" width={32} height={32} className="object-contain w-full h-full" priority />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-[#202333] leading-tight">PGS Hub</span>
              <span className="text-xs text-[#64748B] truncate">{subtitle}</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#202333] hover:bg-[#F2F4F7] transition-colors cursor-pointer"
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4 scrollbar-none">
        {showCheckIn && (
          <Link
            href="/app/attendance"
            title={collapsed ? "Chấm công" : undefined}
            className={`flex items-center gap-2.5 rounded-lg bg-[#7257F5] hover:bg-[#6044E8] text-white text-sm font-semibold transition-colors ${collapsed ? "justify-center h-10" : "px-3 h-10"}`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Chấm công</span>}
          </Link>
        )}
        {navGroups.map((group, gi) => (
          <div key={group.groupTitle || gi} className="space-y-0.5">
            {!collapsed && group.groupTitle && (
              <div className="px-2.5 pb-1 text-xs font-medium text-[#64748B]">{group.groupTitle}</div>
            )}
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.title}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 h-9 rounded-lg text-sm transition-colors ${collapsed ? "justify-center" : "px-2.5"} ${
                    active ? "bg-[#F2EEFF] text-[#5B3FD6] font-semibold" : "text-[#475569] hover:text-[#202333] hover:bg-[#F2F4F7]"
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-[#5B3FD6]" : "text-[#64748B]"}`} />
                  {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                  {!collapsed && item.badge && (
                    <span className="px-1.5 rounded-full bg-[#F2F4F7] text-[#475569] text-xs font-semibold">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={`mt-auto border-t border-[#E7E9F0] shrink-0 ${collapsed ? "p-2 flex flex-col items-center gap-2" : "p-3 space-y-1"}`}>
        <Link
          href={supportHref}
          title={collapsed ? "Hỗ trợ" : undefined}
          className={`flex items-center gap-2.5 h-9 rounded-lg text-sm text-[#475569] hover:text-[#202333] hover:bg-[#F2F4F7] ${collapsed ? "justify-center w-10" : "px-2.5"}`}
        >
          <HelpCircle className="w-[18px] h-[18px] text-[#64748B]" />
          {!collapsed && <span>{account.role === "client" ? "Trung tâm hỗ trợ" : "Hướng dẫn & thông báo"}</span>}
        </Link>
        <Link href="/app/profile" className={`flex items-center gap-2.5 rounded-lg hover:bg-[#F2F4F7] ${collapsed ? "p-1" : "p-1.5"}`} title={collapsed ? displayName : undefined}>
          <Avatar src={user?.avatarUrl} name={displayName} size="sm" />
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-sm font-medium text-[#202333] truncate">{displayName}</p>
              <p className="text-xs text-[#64748B] truncate">{roleLabel}</p>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
