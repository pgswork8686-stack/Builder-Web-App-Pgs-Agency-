"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  UserCheck,
  Clock,
} from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  ROLE_LABELS,
  type NavItem,
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

export function Sidebar({
  account,
  user,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const navGroups = account.role ? getNavigationForRole(account.role) : [];
  const subtitle = account.role
    ? ROLE_HEADER_SUBTITLE[account.role] || "Agency Workspace"
    : "Agency Workspace";
  const roleLabel = account.role ? ROLE_LABELS[account.role] : "Người dùng";

  // Derive real display name from authenticated user payload
  const displayName =
    user?.fullName ||
    user?.email?.split("@")[0] ||
    roleLabel.split("(")[0].trim();

  // Determine support destination
  const supportHref =
    account.role === "client" ? "/app/client/support" : "/app/notifications";

  return (
    <aside
      className={`hidden lg:flex flex-col h-full border-r border-[#F2EAD3] bg-white text-[#161827] transition-all duration-300 z-20 select-none shrink-0 ${
        collapsed ? "w-20" : "w-[252px]"
      }`}
    >
      {/* Brand Header - Fixed Top (78px height) with Real PGS Agency Logo */}
      <div className="h-[78px] flex items-center justify-between px-3.5 border-b border-[#F2EAD3] shrink-0 bg-white">
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-[52px] h-[38px] rounded-xl bg-[#FFF8E5] p-1 flex items-center justify-center shrink-0 overflow-hidden border border-[#FDE68A]">
            <Image
              src="/brand/pgs-agency-logo-transparent.png"
              alt="PGS Agency"
              width={36}
              height={36}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-[#161827] leading-tight">
                PGS Hub
              </span>
              <span className="text-[10px] font-bold text-[#475569] tracking-tight truncate">
                {subtitle}
              </span>
            </div>
          )}
        </Link>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#161827] hover:bg-[#FFF8E5] transition-colors cursor-pointer"
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
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-3 scrollbar-none">
        {/* Dedicated Highlight Action if Admin */}
        {!collapsed && account.role === "admin" && (
          <Link
            href="/app/admin/accounts/pending"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8E5] border border-[#FDE68A] text-[#161827] hover:bg-[#FDF1C7] transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#E7AE18] text-[#161827] flex items-center justify-center font-bold">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#161827] transition-colors">
                Yêu cầu tài khoản
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#E7AE18] animate-pulse" />
          </Link>
        )}

        {/* Dedicated Highlight Action if Employee */}
        {!collapsed && account.role === "employee" && (
          <Link
            href="/app/attendance"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF8E5] border border-[#FDE68A] text-[#161827] hover:bg-[#FDF1C7] transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#FFC400] text-[#161827] flex items-center justify-center font-bold">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#161827]">
                Chấm công bắt buộc
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFC400] text-[#161827]">
              GPS
            </span>
          </Link>
        )}

        {navGroups.map((group, groupIdx) => (
          <div key={group.groupTitle || groupIdx} className="space-y-0.5">
            {!collapsed && group.groupTitle && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                {group.groupTitle}
              </div>
            )}
            {group.items.map((item, itemIdx) => {
              const active = isNavItemActive(pathname, item);
              const Icon = item.icon;
              const itemNum =
                item.index || (itemIdx + 1).toString().padStart(2, "0");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 group relative select-none ${
                    active
                      ? "bg-[#FDF1C7] text-[#8A6400] font-bold border-l-[3px] border-[#E7AE18]"
                      : "text-[#475569] hover:text-[#161827] hover:bg-[#FFF8E5]"
                  } ${collapsed ? "justify-center px-0 py-2 border-l-0" : ""}`}
                >
                  {!collapsed && (
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        active ? "text-[#8A6400]" : "text-[#64748B]"
                      }`}
                    >
                      {itemNum}
                    </span>
                  )}

                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      active
                        ? "text-[#8A6400]"
                        : "text-[#475569] group-hover:text-[#161827]"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.title}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#FDE68A] text-[#8A6400] text-[9px] font-bold">
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
        <div className="mt-auto p-3 border-t border-[#F2EAD3] space-y-2 shrink-0 bg-white">
          <div className="p-2.5 rounded-xl bg-[#FFF8E5] border border-[#FDE68A] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#8A6400] text-xs font-bold">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Cần hỗ trợ?</span>
            </div>
            <p className="text-[10px] text-[#475569] leading-tight">
              {account.role === "client"
                ? "Gửi yêu cầu hỗ trợ và ticket tới bộ phận CSKH."
                : "Xem hướng dẫn và trung tâm trợ giúp hệ thống."}
            </p>
            <Link
              href={supportHref}
              className="w-full py-1.5 px-2 rounded-lg bg-[#E7AE18] hover:bg-[#CC9410] text-[#161827] text-[10px] font-black transition-colors block text-center shadow-xs"
            >
              {account.role === "client"
                ? "Mở trung tâm hỗ trợ"
                : "Mở hướng dẫn"}
            </Link>
          </div>

          {/* Authenticated User Preview Card */}
          <Link
            href="/app/profile"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#FFF8E5] transition-colors group"
          >
            <Avatar name={displayName} size="sm" />
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-xs font-bold text-[#161827] truncate transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-[#475569] truncate">{roleLabel}</p>
            </div>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
