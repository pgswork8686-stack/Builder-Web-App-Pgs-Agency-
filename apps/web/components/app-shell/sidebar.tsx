"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { getNavigationForRole, type NavItem } from "./role-navigation";
import type { AccountPayload } from "@/lib/api/auth";

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

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-[#EDF2F7] bg-white transition-all duration-300 relative z-20 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDF2F7]">
        <Link href="/app" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#4F75FF] text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
            P
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-[#0F172A]">
                PGS Hub
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] tracking-wider uppercase capitalize">
                {account.role ? account.role.replace("_", " ") : "Enterprise"}
              </span>
            </div>
          )}
        </Link>

        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
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

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none">
        {navGroups.map((group, groupIdx) => (
          <div key={group.groupTitle || groupIdx} className="space-y-1">
            {!collapsed && group.groupTitle && (
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {group.groupTitle}
              </div>
            )}
            {group.items.map((item, itemIdx) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const itemNum = (itemIdx + 1).toString().padStart(2, "0");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group relative ${
                    active
                      ? "bg-[#EEF2FF] text-[#4F75FF] font-bold"
                      : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  {!collapsed ? (
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        active ? "text-[#4F75FF]" : "text-[#94A3B8]"
                      }`}
                    >
                      {itemNum}
                    </span>
                  ) : null}

                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      active
                        ? "text-[#4F75FF]"
                        : "text-[#64748B] group-hover:text-[#0F172A]"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.title}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#4F75FF]/10 text-[#4F75FF] text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer / Support & User Pill */}
      {!collapsed ? (
        <div className="p-4 border-t border-[#EDF2F7] space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#EEF2FF] border border-[#E0EAFF] space-y-2">
            <div className="flex items-center gap-2 text-[#4F75FF] text-xs font-bold">
              <HelpCircle className="w-4 h-4" />
              <span>Cần hỗ trợ?</span>
            </div>
            <p className="text-[11px] text-[#64748B] leading-tight">
              Xem hướng dẫn & quy trình sử dụng theo vai trò.
            </p>
            <button
              type="button"
              className="w-full py-1.5 px-2 rounded-xl bg-[#4F75FF] hover:bg-[#3D62EE] text-white text-[11px] font-bold transition-colors cursor-pointer"
            >
              Mở hướng dẫn
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
