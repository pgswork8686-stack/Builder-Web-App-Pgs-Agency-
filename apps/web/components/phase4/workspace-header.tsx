"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  LayoutDashboard,
} from "lucide-react";
import { RealtimeStatus } from "./project-workspace-realtime-provider";

export type WorkspaceMode = "admin" | "internal";

export function WorkspaceHeader({
  mode,
  projectId,
  projectName,
  projectCode,
  active,
}: {
  mode: WorkspaceMode;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  active: "board" | "calendar" | "files" | "task";
}) {
  const base =
    mode === "admin"
      ? `/app/admin/projects/${projectId}`
      : `/app/projects/${projectId}`;

  const links = [
    {
      key: "board",
      label: "Kanban Board",
      href: `${base}/board`,
      icon: LayoutDashboard,
    },
    {
      key: "calendar",
      label: "Lịch biểu",
      href: `${base}/calendar`,
      icon: CalendarDays,
    },
    { key: "files", label: "Tệp tin", href: `${base}/files`, icon: FolderOpen },
  ] as const;

  return (
    <header className="space-y-4 pb-4 border-b border-[#EDF2F7]">
      <Link
        href={base}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Tổng quan dự án</span>
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F75FF] bg-[#EEF2FF] px-2.5 py-0.5 rounded-full border border-[#E0EAFF]">
              {projectCode ?? "PROJECT"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-[#0F172A] tracking-tight sm:text-3xl">
            {projectName ?? "Không gian thực thi dự án"}
          </h1>
        </div>
        <RealtimeStatus />
      </div>

      <nav
        className="flex gap-2 overflow-x-auto scrollbar-none pt-1"
        aria-label="Không gian dự án"
      >
        {links.map(({ key, label, href, icon: Icon }) => {
          const isActive =
            active === key || (active === "task" && key === "board");
          return (
            <Link
              key={key}
              href={href}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 ${
                isActive
                  ? "bg-[#4F75FF] text-white shadow-xs"
                  : "bg-white text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
