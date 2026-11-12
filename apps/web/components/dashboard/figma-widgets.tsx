"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/* Thành phần dùng chung cho các dashboard theo Figma (thẻ widget, ô KPI, trạng thái trống). */

export function shortDate(iso: string | null) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export { compactVND, fullVND } from "@/lib/format";

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function Widget({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-xl border border-[#E7E9F0] p-4 flex flex-col gap-3 ${className}`}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#202333]">
          <span className="text-[#94A3B8]">{icon}</span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ text = "Chưa có dữ liệu" }: { text?: string }) {
  return (
    <div className="flex-1 grid place-items-center py-8 text-sm text-[#64748B]">
      {text}
    </div>
  );
}

export function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 min-h-11 sm:min-h-0 text-sm font-medium text-[#5B3FD6] hover:underline"
    >
      {label}
      <ChevronRight className="w-3.5 h-3.5" />
    </Link>
  );
}

export function Kpi({
  label,
  value,
  sub,
  icon,
  bg,
  border,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
}) {
  // V2: ô luôn nền trắng; màu chỉ ở con số khi có nghĩa (đỏ = quá hạn/lỗi, cam = cần duyệt).
  const key = bg.toUpperCase();
  const tone = key === "#FEE2E2" ? "text-[#B42318]" : key === "#FEF9C3" ? "text-[#B54708]" : "text-[#202333]";
  void border;
  return (
    <div className="rounded-xl border border-[#E7E9F0] bg-white px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#64748B] leading-tight">{label}</span>
        <span className="text-[#94A3B8] shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
      <div className="text-xs text-[#64748B] truncate">{sub}</div>
    </div>
  );
}

