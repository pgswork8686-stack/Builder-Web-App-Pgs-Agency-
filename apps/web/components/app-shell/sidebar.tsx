"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  UserCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  ROLE_LABELS,
  type NavItem,
} from "./role-navigation";
import type { AccountPayload } from "@/lib/api/auth";
import { Avatar } from "@/components/ui/avatar";

export interface SidebarProps {
  account: AccountPayload;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  account,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const navGroups = account.role ? getNavigationForRole(account.role) : [];
  const subtitle = account.role
    ? ROLE_HEADER_SUBTITLE[account.role] || "Agency Workspace"
    : "Agency Workspace";
  const roleLabel = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName =
    account.role === "admin"
      ? "Phùng Quốc Bảo"
      : roleLabel.split("(")[0].trim();

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <aside
      className={`hidden lg:flex flex-col sticky top-0 h-screen border-r border-[#EDF2F7] bg-white transition-all duration-300 z-20 select-none shrink-0 shadow-[1px_0_4px_rgba(0,0,0,0.02)] ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header - Fixed Top */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#EDF2F7] shrink-0">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#5D87FF] text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
            P
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm tracking-tight text-[#24304A]">
                PGS Hub
              </span>
              <span className="text-[10px] font-semibold text-[#7C879D] tracking-tight">
                {subtitle}
              </span>
            </div>
          )}
        </Link>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded-lg text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC] transition-colors cursor-pointer"
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links - Scrollable Center Area */}
      <div className="flex-1 overflow-y-auto py-2.5 px-2.5 space-y-3 scrollbar-none">
        {/* Dedicated Highlight Action if Admin or Employee */}
        {!collapsed && account.role === "admin" && (
          <Link
            href="/app/admin/accounts/pending"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#EEF2FF] border border-[#5D87FF]/20 text-[#5D87FF] hover:bg-[#E0EAFF] transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#5D87FF] text-white flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#24304A] group-hover:text-[#5D87FF]">
                Yêu cầu tài khoản
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#5D87FF] animate-pulse" />
          </Link>
        )}

        {!collapsed && account.role === "employee" && (
          <Link
            href="/app/attendance"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#FEF9C3] border border-[#FFC400]/40 text-[#92400E] hover:bg-[#FEF08A] transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#FFC400] text-white flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-bold text-[#92400E]">
                Chấm công bắt buộc
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFC400] text-white">
              GPS
            </span>
          </Link>
        )}

        {navGroups.map((group, groupIdx) => (
          <div key={group.groupTitle || groupIdx} className="space-y-0.5">
            {!collapsed && group.groupTitle && (
              <div className="px-2.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-[#7C879D]">
                {group.groupTitle}
              </div>
            )}
            {group.items.map((item, itemIdx) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const itemNum =
                item.index || (itemIdx + 1).toString().padStart(2, "0");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 group relative ${
                    active
                      ? "bg-[#EEF2FF] text-[#5D87FF] font-bold shadow-2xs"
                      : "text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC]"
                  } ${collapsed ? "justify-center px-0 py-2" : ""}`}
                >
                  {!collapsed && (
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        active ? "text-[#5D87FF]" : "text-[#7C879D]"
                      }`}
                    >
                      {itemNum}
                    </span>
                  )}

                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      active
                        ? "text-[#5D87FF]"
                        : "text-[#7C879D] group-hover:text-[#24304A]"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.title}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#5D87FF]/10 text-[#5D87FF] text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / Support & User Card - Fixed to Bottom (mt-auto) */}
      {!collapsed ? (
        <div className="mt-auto p-3 border-t border-[#EDF2F7] space-y-2 shrink-0 bg-white">
          <div className="p-2.5 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#5D87FF] text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Cần hỗ trợ?</span>
            </div>
            <p className="text-[10px] text-[#7C879D] leading-tight">
              {account.role === "admin"
                ? "Xem hướng dẫn hoặc gửi yêu cầu hỗ trợ."
                : "Xem hướng dẫn và quy trình theo vai trò."}
            </p>
            <button
              type="button"
              className="w-full py-1 px-2 rounded-lg bg-[#5D87FF] hover:bg-[#4F75FF] text-white text-[10px] font-bold transition-colors cursor-pointer"
            >
              {account.role === "admin"
                ? "Mở trung tâm hỗ trợ"
                : "Mở hướng dẫn"}
            </button>
          </div>

          {/* Authenticated User Preview Card */}
          <Link
            href="/app/profile"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#F6F8FC] transition-colors group"
          >
            <Avatar name={displayName} size="sm" />
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-xs font-bold text-[#24304A] truncate group-hover:text-[#5D87FF]">
                {displayName}
              </p>
              <p className="text-[10px] text-[#7C879D] truncate">
                {account.role === "admin"
                  ? "Quản trị viên (Admin)"
                  : account.role || "Tài khoản hệ thống"}
              </p>
            </div>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
