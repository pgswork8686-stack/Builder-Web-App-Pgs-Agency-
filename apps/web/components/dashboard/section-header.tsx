import React from "react";
import { Badge } from "@/components/ui/badge";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  badgeVariant?:
    | "default"
    | "blue"
    | "gold"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "cyan"
    | "outline";
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  badge,
  badgeVariant = "blue",
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EDF2F7] ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
            {title}
          </h2>
          {badge && (
            <Badge variant={badgeVariant} size="sm">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-2 shrink-0">{action}</div>
      )}
    </div>
  );
}
