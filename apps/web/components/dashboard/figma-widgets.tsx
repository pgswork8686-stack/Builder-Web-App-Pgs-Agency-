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

export /** 1.250.000.000 → "1,25 tỷ"; 85.500.000 → "85,5tr". */
function compactVND(n: number) {
  if (!n) return "0 ₫";
  const f = (v: number) =>
    v.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1e9) return `${f(n / 1e9)} tỷ`;
  if (Math.abs(n) >= 1e6) return `${f(n / 1e6)}tr`;
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export function fullVND(n: number) {
  return `${(n || 0).toLocaleString("vi-VN")} ₫`;
}

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
      className={`bg-white rounded-2xl border border-[#F2EAD3] p-5 flex flex-col gap-3 ${className}`}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#161827]">
          <span className="text-[#475569]">{icon}</span>
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
    <div className="flex-1 grid place-items-center py-8 text-sm text-[#94A3B8]">
      {text}
    </div>
  );
}

export function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-bold text-[#8A6400] hover:text-[#161827]"
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
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 border"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#475569] leading-tight">
          {label}
        </span>
        <span className="w-9 h-9 rounded-xl bg-white/80 grid place-items-center text-[#161827] shrink-0">
          {icon}
        </span>
      </div>
      <div className="text-[30px] leading-none font-bold text-[#161827]">
        {value}
      </div>
      <div className="text-xs text-[#475569]">{sub}</div>
    </div>
  );
}

