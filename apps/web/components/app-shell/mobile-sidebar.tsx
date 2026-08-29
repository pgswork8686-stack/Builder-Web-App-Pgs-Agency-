"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, HelpCircle, UserCheck, Clock } from "lucide-react";
import {
  getNavigationForRole,
  ROLE_HEADER_SUBTITLE,
  ROLE_LABELS,
  type NavItem,
} from "./role-navigation";
import { isNavItemActive } from "./navigation-utils";
import type { AccountPayload, UserPayload } from "@/lib/api/auth";
import { Avatar } from "@/components/ui/avatar";

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountPayload;
  user?: UserPayload | null;
}

export function MobileSidebar({
  isOpen,
  onClose,
  account,
  user,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const navGroups = account.role ? getNavigationForRole(account.role) : [];
  const subtitle = account.role
    ? ROLE_HEADER_SUBTITLE[account.role] || "Agency Workspace"
    : "Agency Workspace";
  const roleLabel = account.role ? ROLE_LABELS[account.role] : "Người dùng";
  const displayName =
    user?.fullName ||
    user?.email?.split("@")[0] ||
    roleLabel.split("(")[0].trim();

  if (!isOpen) return null;

  const supportHref =
    account.role === "client" ? "/app/client/support" : "/app/notifications";

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Sidebar Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-[#161827] text-white flex flex-col z-10 shadow-2xl border-r border-[#222638] animate-in slide-in-from-left duration-200">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#222638]">
          <Link
            href="/app"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <div className="relative w-8 h-8 rounded-xl bg-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
              <Image
                src="/brand/pgs-agency-logo-transparent.png"
                alt="PGS Agency"
                width={32}
                height={32}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight text-white">
                PGS Hub
              </span>
              <span className="text-[10px] font-semibold text-[#94A3B8] tracking-tight truncate">
                {subtitle}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3">
          {/* Highlight Cards */}
          {account.role === "admin" && (
            <Link
              href="/app/admin/accounts/pending"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-xl bg-[#E7AE18]/10 border border-[#E7AE18]/25 text-[#F3BA2F] block"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-[#E7AE18]" />
                <span className="text-xs font-bold text-white">
                  Yêu cầu tài khoản
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#E7AE18] animate-pulse" />
            </Link>
          )}

          {account.role === "employee" && (
            <Link
              href="/app/attendance"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-xl bg-[#FEF9C3]/10 border border-[#FFC400]/30 text-[#FDE047] block"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#161827] p-0.5 rounded-sm bg-[#FFC400]" />
                <span className="text-xs font-bold text-white">
                  Chấm công bắt buộc
                </span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#FFC400] text-[#161827]">
                GPS
              </span>
            </Link>
          )}

          {navGroups.map((group, groupIdx) => (
            <div key={group.groupTitle || groupIdx} className="space-y-0.5">
              {group.groupTitle && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
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
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? "bg-[#E7AE18]/15 text-[#F3BA2F] font-bold border-l-2 border-[#E7AE18]"
                        : "text-[#94A3B8] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        active ? "text-[#E7AE18]" : "text-[#64748B]"
                      }`}
                    >
                      {itemNum}
                    </span>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#E7AE18]" : "text-[#94A3B8]"
                      }`}
                    />
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#E7AE18]/20 text-[#F3BA2F] text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Support & Profile */}
        <div className="p-4 border-t border-[#222638] space-y-3 bg-[#161827]">
          <Link
            href={supportHref}
            onClick={onClose}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-[#E7AE18] hover:text-[#161827] transition-all block"
          >
            <HelpCircle className="w-4 h-4 text-[#E7AE18]" />
            <span>
              {account.role === "client"
                ? "Trung tâm hỗ trợ"
                : "Hướng dẫn & Trợ giúp"}
            </span>
          </Link>

          <Link
            href="/app/profile"
            onClick={onClose}
            className="flex items-center gap-3 p-1 rounded-xl"
          >
            <Avatar name={displayName} size="sm" />
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-[#94A3B8] truncate">{roleLabel}</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
