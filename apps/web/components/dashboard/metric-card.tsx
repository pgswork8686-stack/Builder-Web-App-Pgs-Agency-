import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export interface MetricItem {
  label: string;
  value: string | number;
  subValue?: string;
  percentage?: number;
  color?: string;
}

export interface MetricCardProps {
  title: string;
  description?: string;
  items: MetricItem[];
  className?: string;
  headerAction?: React.ReactNode;
}

export function MetricCard({
  title,
  description,
  items,
  className = "",
  headerAction,
}: MetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.label + idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-[#475569] font-medium">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[#202333] font-bold">{item.value}</span>
                {item.subValue && (
                  <span className="text-xs text-[#64748B] font-mono">
                    {item.subValue}
                  </span>
                )}
              </div>
            </div>

            {typeof item.percentage === "number" && (
              <div className="h-1.5 w-full rounded-full bg-[#F4F2FD] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.color || "bg-gradient-to-r from-[#6044E8] to-[#38BDF8]"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
