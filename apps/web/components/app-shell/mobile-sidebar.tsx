"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles, UserCheck, Clock } from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  type NavItem,
} from "./role-navigation";
import type { AccountPayload } from "@/lib/api/auth";

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountPayload;
}

export function MobileSidebar({
  isOpen,
  onClose,
  account,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const navGroups = account.role ? getNavigationForRole(account.role) : [];
  const subtitle = account.role
    ? ROLE_HEADER_SUBTITLE[account.role] || "Agency Workspace"
    : "Agency Workspace";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-4/5 max-w-xs h-full bg-white border-r border-[#EDF2F7] flex flex-col z-10 shadow-xl animate-in slide-in-from-left duration-250">
        {/* Drawer Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDF2F7]">
          <Link
            href="/app"
            onClick={onClose}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-[#5D87FF] text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
              P
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-black text-sm tracking-tight text-[#24304A]">
                PGS Hub
              </span>
              <span className="text-[11px] font-semibold text-[#7C879D] tracking-tight">
                {subtitle}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC] transition-colors cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {/* Highlight Actions */}
          {account.role === "admin" && (
            <Link
              href="/app/admin/accounts/pending"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#EEF2FF] border border-[#5D87FF]/20 text-[#5D87FF]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#5D87FF] text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#24304A]">
                  Yêu cầu tài khoản
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#5D87FF] animate-pulse" />
            </Link>
          )}

          {account.role === "employee" && (
            <Link
              href="/app/attendance"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#FEF9C3] border border-[#FFC400]/40 text-[#92400E]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FFC400] text-white flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-[#92400E]">
                  Chấm công bắt buộc
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFC400] text-white">
                GPS
              </span>
            </Link>
          )}

          {navGroups.map((group, groupIdx) => (
            <div key={group.groupTitle || groupIdx} className="space-y-1">
              {group.groupTitle && (
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7C879D]">
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
                    onClick={onClose}
                    className={`min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active
                        ? "bg-[#EEF2FF] text-[#5D87FF] font-bold"
                        : "text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC]"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        active ? "text-[#5D87FF]" : "text-[#7C879D]"
                      }`}
                    >
                      {itemNum}
                    </span>

                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        active ? "text-[#5D87FF]" : "text-[#7C879D]"
                      }`}
                    />
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#5D87FF] text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EDF2F7]">
          <div className="p-3 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#5D87FF] flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#24304A] truncate">
                PGS Platform
              </span>
              <span className="text-[10px] text-[#13DEB9] font-medium">
                Hệ thống ổn định
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
