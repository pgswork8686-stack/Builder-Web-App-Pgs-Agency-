"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Panel chi tiết bên phải (V2): xem/duyệt nhanh mà không rời danh sách. Điện thoại: toàn màn hình. */
export function Drawer({ open, onClose, title, subtitle, children, footer }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#202333]/20" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative h-full w-full sm:w-[440px] bg-white shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)] flex flex-col outline-none"
      >
        <header className="flex items-start gap-3 px-5 py-4 border-b border-[#E7E9F0]">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[#202333]">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-[#64748B]">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="p-2 -m-1 rounded-lg text-[#64748B] hover:bg-[#F2F4F7] hover:text-[#202333]">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-[#E7E9F0] flex items-center justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

/** Hàng nhãn — giá trị trong drawer. */
export function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-[#202333] min-w-0 break-words">{children}</span>
    </div>
  );
}
