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
      label: "Kanban",
      href: `${base}/board`,
      icon: LayoutDashboard,
    },
    {
      key: "calendar",
      label: "Lịch",
      href: `${base}/calendar`,
      icon: CalendarDays,
    },
    { key: "files", label: "Tệp", href: `${base}/files`, icon: FolderOpen },
  ] as const;
  return (
    <header className="space-y-5 border-b border-zinc-800 pb-5">
      <Link
        href={base}
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Tổng quan dự án
      </Link>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFC400]">
            {projectCode ?? "PROJECT WORKSPACE"}
          </p>
          <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
            {projectName ?? "Không gian thực thi dự án"}
          </h1>
        </div>
        <RealtimeStatus />
      </div>
      <nav className="flex gap-2 overflow-x-auto" aria-label="Không gian dự án">
        {links.map(({ key, label, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${active === key || (active === "task" && key === "board") ? "bg-[#FFC400] text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
