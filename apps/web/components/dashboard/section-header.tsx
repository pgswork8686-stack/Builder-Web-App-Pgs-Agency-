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
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F2EAD3] ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold text-[#161827] tracking-tight">
            {title}
          </h2>
          {badge && (
            <Badge variant={badgeVariant} size="sm">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-[#475569] leading-relaxed">
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
