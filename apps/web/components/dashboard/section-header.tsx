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
  badgeVariant = "default",
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#202333]">
            {title}
          </h1>
          {badge && (
            <Badge variant={badgeVariant} size="sm">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-[#64748B]">
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
