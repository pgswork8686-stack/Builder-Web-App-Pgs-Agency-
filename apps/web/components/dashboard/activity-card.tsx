import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export interface ActivityItem {
  id: string;
  user?: {
    name?: string | null;
    avatarUrl?: string | null;
  };
  title: string;
  description?: string;
  timestamp: string;
  badge?: React.ReactNode;
}

export interface ActivityCardProps {
  title: string;
  description?: string;
  activities: ActivityItem[];
  emptyMessage?: string;
  className?: string;
  headerAction?: React.ReactNode;
}

export function ActivityCard({
  title,
  description,
  activities,
  emptyMessage = "Chưa có hoạt động mới nào gần đây.",
  className = "",
  headerAction,
}: ActivityCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#606060]">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 pb-3 border-b border-[#1C1C1E]/40 last:border-none last:pb-0"
              >
                <Avatar
                  name={item.user?.name}
                  src={item.user?.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </span>
                    {item.badge}
                  </div>
                  {item.description && (
                    <p className="text-xs text-[#8E8E93] line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <span className="text-[10px] text-[#606060] block">
                    {item.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
