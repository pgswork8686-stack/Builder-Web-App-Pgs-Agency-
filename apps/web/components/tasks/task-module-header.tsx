"use client";

import React from "react";
import { TaskViewTabs, type TaskView } from "./task-view-tabs";
import { Badge } from "@/components/ui/badge";

export interface TaskModuleHeaderProps {
  role?: "admin" | "team_leader";
  activeView: TaskView;
  title: string;
  description: string;
  badge?: string;
  actions?: React.ReactNode;
  links?: {
    list: string;
    kanban: string;
    calendar: string;
  };
}

export function TaskModuleHeader({
  role = "admin",
  activeView,
  title,
  description,
  badge,
  actions,
  links,
}: TaskModuleHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Top row: Title, Badge, and Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#161827] tracking-tight">
              {title}
            </h1>
            {badge && (
              <Badge variant="brand" size="sm">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {/* Bottom row: View Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
        <TaskViewTabs active={activeView} role={role} links={links} />
      </div>
    </div>
  );
}
