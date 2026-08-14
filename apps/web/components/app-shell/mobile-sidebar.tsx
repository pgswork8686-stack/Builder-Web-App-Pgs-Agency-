"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { getNavigationForRole, type NavItem } from "./role-navigation";
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4F75FF] to-[#38BDF8] text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
              P
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-wider text-[#0F172A]">
                PGS HUB
              </span>
              <span className="text-[10px] font-semibold text-[#4F75FF] tracking-widest uppercase">
                Agency OS
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupTitle || groupIdx} className="space-y-1">
              {group.groupTitle && (
                <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  {group.groupTitle}
                </div>
              )}
              {group.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-[#EEF2FF] text-[#4F75FF] font-bold"
                        : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        active ? "text-[#4F75FF]" : "text-[#94A3B8]"
                      }`}
                    />
                    <span className="truncate flex-1">{item.title}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F75FF] text-[10px] font-bold">
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
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#0F172A] truncate">
                PGS Platform
              </span>
              <span className="text-[10px] text-[#059669] font-medium">
                Hệ thống ổn định
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
