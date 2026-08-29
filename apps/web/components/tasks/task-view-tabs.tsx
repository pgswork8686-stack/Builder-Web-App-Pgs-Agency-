"use client";

import React from "react";
import Link from "next/link";
import { ListTodo, Kanban, CalendarDays, type LucideIcon } from "lucide-react";

export type TaskView = "list" | "kanban" | "calendar";

export interface TaskViewTabsProps {
  active: TaskView;
  role?: "admin" | "team_leader";
  links?: {
    list: string;
    kanban: string;
    calendar: string;
  };
  className?: string;
}

export function TaskViewTabs({
  active,
  role = "admin",
  links,
  className = "",
}: TaskViewTabsProps) {
  const defaultLinks = {
    admin: {
      list: "/app/admin/tasks",
      kanban: "/app/admin/kanban",
      calendar: "/app/admin/calendar",
    },
    team_leader: {
      list: "/app/team-leader/tasks",
      kanban: "/app/team-leader/kanban",
      calendar: "/app/team-leader/calendar",
    },
  };

  const resolvedLinks = links || defaultLinks[role];

  const tabs: {
    key: TaskView;
    label: string;
    href: string;
    icon: LucideIcon;
  }[] = [
    {
      key: "list",
      label: "Danh sách",
      href: resolvedLinks.list,
      icon: ListTodo,
    },
    {
      key: "kanban",
      label: "Kanban",
      href: resolvedLinks.kanban,
      icon: Kanban,
    },
    {
      key: "calendar",
      label: "Lịch biểu",
      href: resolvedLinks.calendar,
      icon: CalendarDays,
    },
  ];

  return (
    <nav
      aria-label="Chế độ xem công việc"
      className={`inline-flex items-center gap-1 p-1 bg-white border border-[#EDF2F7] rounded-xl shadow-2xs overflow-x-auto scrollbar-none max-w-full ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 select-none shrink-0 cursor-pointer ${
              isActive
                ? "bg-[#E7AE18] text-[#161827] shadow-xs"
                : "text-[#64748B] hover:text-[#161827] hover:bg-[#FFF8E5]"
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive
                  ? "text-[#161827]"
                  : "text-[#7C879D] group-hover:text-[#161827]"
              }`}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
