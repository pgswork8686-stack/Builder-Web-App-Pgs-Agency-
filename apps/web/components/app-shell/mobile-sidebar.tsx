"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, HelpCircle, UserCheck, Clock } from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  ROLE_LABELS,
  type NavItem,
} from "./role-navigation";
import type { AccountPayload } from "@/lib/api/auth";
import { Avatar } from "@/components/ui/avatar";

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
  const roleLabel = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName =
    account.role === "admin"
      ? "Phùng Quốc Bảo"
      : roleLabel.split("(")[0].trim();

  if (!isOpen) return null;

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white flex flex-col z-10 shadow-2xl border-r border-[#EDF2F7] animate-in slide-in-from-left duration-200">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDF2F7]">
          <Link
            href="/app"
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-[#5D87FF] text-white font-black flex items-center justify-center text-sm shadow-md">
              P
            </div>
            <div className="flex flex-col">
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
            className="p-1.5 rounded-xl text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC] transition-colors cursor-pointer"
            aria-label="Đóng sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {/* Highlight Cards */}
          {account.role === "admin" && (
            <Link
              href="/app/admin/accounts/pending"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#EEF2FF] border border-[#5D87FF]/20 text-[#5D87FF] block"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4" />
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
              className="flex items-center justify-between p-3 rounded-2xl bg-[#FEF9C3] border border-[#FFC400]/40 text-[#92400E] block"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#FFC400]" />
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
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#7C879D]">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
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
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#5D87FF]" : "text-[#7C879D]"
                      }`}
                    />
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#5D87FF]/10 text-[#5D87FF] text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-[#EDF2F7]">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7]">
            <Avatar name={displayName} size="sm" />
            <div className="flex flex-col min-w-0 flex-1">
              <p className="text-xs font-bold text-[#24304A] truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-[#7C879D] truncate">
                {account.role === "admin"
                  ? "Quản trị viên (Admin)"
                  : account.role || "Tài khoản hệ thống"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
