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
    ? ROLE_HEADER_SUBTITLE[account.role] || "Không gian Agency"
    : "Không gian Agency";
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
      <div className="fixed inset-y-0 left-0 w-72 bg-white text-[#202333] flex flex-col z-10 shadow-2xl border-r border-[#E7E9F0] animate-in slide-in-from-left duration-200">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E7E9F0]">
          <Link
            href="/app"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <div className="relative w-8 h-8 rounded-xl bg-[#F2EEFF] p-1 flex items-center justify-center shrink-0 overflow-hidden border border-[#DDD5FF]">
              <Image
                src="/brand/pgs-agency-logo-transparent.png"
                alt="PGS Agency"
                width={32}
                height={32}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-tight text-[#202333]">
                PGS Hub
              </span>
              <span className="text-xs font-semibold text-[#475569] tracking-tight truncate">
                {subtitle}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#475569] hover:text-[#202333] hover:bg-[#F2EEFF] transition-colors cursor-pointer"
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
              className="flex items-center justify-between p-3 rounded-xl bg-[#F2EEFF] border border-[#DDD5FF] text-[#202333] block"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-[#7257F5]" />
                <span className="text-xs font-bold text-[#202333]">
                  Yêu cầu tài khoản
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#7257F5] animate-pulse" />
            </Link>
          )}

          {account.role === "employee" && (
            <Link
              href="/app/attendance"
              onClick={onClose}
              className="flex items-center justify-between p-3 rounded-xl bg-[#F2EEFF] border border-[#DDD5FF] text-[#202333] block"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#202333] p-0.5 rounded-sm bg-[#7257F5]" />
                <span className="text-xs font-bold text-[#202333]">
                  Chấm công bắt buộc
                </span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#7257F5] text-[#202333]">
                GPS
              </span>
            </Link>
          )}

          {navGroups.map((group, groupIdx) => (
            <div key={group.groupTitle || groupIdx} className="space-y-0.5">
              {group.groupTitle && (
                <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-[#475569]">
                  {group.groupTitle}
                </div>
              )}
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href + item.title}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 h-11 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-[#F2EEFF] text-[#5B3FD6] font-semibold"
                        : "text-[#475569] hover:text-[#202333] hover:bg-[#F2F4F7]"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#7257F5]" : "text-[#475569]"
                      }`}
                    />
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#7257F5]/20 text-[#7257F5] text-xs font-bold">
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
        <div className="p-4 border-t border-[#E7E9F0] space-y-3 bg-white">
          <Link
            href={supportHref}
            onClick={onClose}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F2EEFF] text-sm font-semibold text-[#5B3FD6] hover:bg-[#E7E0FF] transition-all block"
          >
            <HelpCircle className="w-4 h-4 text-[#7257F5]" />
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
            <Avatar src={user?.avatarUrl} name={displayName} size="sm" />
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-bold text-[#202333] truncate">
                {displayName}
              </p>
              <p className="text-xs text-[#475569] truncate">{roleLabel}</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
