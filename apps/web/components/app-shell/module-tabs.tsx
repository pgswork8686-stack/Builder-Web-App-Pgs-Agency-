"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/api/auth";
import { getActiveModuleTabs, getActiveTabHref } from "./role-navigation";

/**
 * Tab của module (V2): sidebar là module, tab là view/trang con.
 * Chỉ hiện khi đang đứng đúng một tab — trang chi tiết (vd. /projects/[id]) không hiện để tránh nhầm ngữ cảnh.
 */
export function ModuleTabs({ role }: { role: AppRole | null | undefined }) {
  const pathname = usePathname() || "";
  if (!role) return null;
  const mod = getActiveModuleTabs(role, pathname);
  if (!mod) return null;
  const active = getActiveTabHref(mod.tabs, pathname);
  if (!active) return null;
  return (
    <nav aria-label={`Các mục của ${mod.module}`} className="mb-5 -mt-1 border-b border-[#E7E9F0] overflow-x-auto scrollbar-none">
      <ul className="flex items-end gap-1 min-w-max">
        {mod.tabs.map((t) => {
          const on = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex items-center h-10 px-3 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  on ? "border-[#7257F5] text-[#202333] font-semibold" : "border-transparent text-[#64748B] hover:text-[#202333] hover:border-[#DDDFEA]"
                }`}
              >
                {t.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
