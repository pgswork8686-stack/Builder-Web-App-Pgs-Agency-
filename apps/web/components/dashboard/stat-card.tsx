import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: "default" | "blue" | "cyan" | "gold" | "green" | "purple" | "rose";
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  subtitle?: string;
  badge?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  variant = "default",
  trend,
  subtitle,
  badge,
  className = "",
  onClick,
}: StatCardProps) {
  // V2: mọi biến thể nền trắng; chỉ con số mang màu khi có nghĩa (không dùng thẻ màu cầu vồng).
  const valueTone: Record<string, string> = { rose: "text-[#B42318]", gold: "text-[#B54708]", green: "text-[#067647]" };
  const base = { bg: "bg-white border-[#E7E9F0]", iconBg: "text-[#94A3B8]", titleColor: "text-[#64748B]", borderColor: "border-[#E7E9F0]" };
  const variantStyles: Record<string, typeof base & { valueColor: string }> = Object.fromEntries(
    ["default", "blue", "cyan", "gold", "green", "purple", "rose"].map((k) => [k, { ...base, valueColor: valueTone[k] ?? "text-[#202333]" }]),
  );

  const selected = variantStyles[variant] || variantStyles.default;

  // Auto-adjust font size for text vs short numbers
  const valStr = String(value);
  const isLongText = valStr.length > 6;
  const isMediumText = valStr.length > 4;

  const valueFontSize = isLongText
    ? "text-lg sm:text-xl font-bold leading-tight"
    : isMediumText
      ? "text-xl font-semibold tabular-nums"
      : "text-2xl font-semibold tabular-nums";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 relative overflow-hidden transition-colors flex flex-col justify-between h-full ${
        selected.bg
      } ${
        onClick
          ? "cursor-pointer hover:bg-[#FBFBFD]"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs ${selected.titleColor} truncate`}
            >
              {title}
            </span>
            {badge && (
              <Badge variant="default" size="sm">
                {badge}
              </Badge>
            )}
          </div>
          <div
            className={`${valueFontSize} ${selected.valueColor} truncate`}
            title={valStr}
          >
            {value}
          </div>
        </div>

        {icon && (
          <div
            className={`shrink-0 [&>svg]:w-4 [&>svg]:h-4 ${selected.iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>

      {(trend || subtitle) && (
        <div
          className={`mt-3 pt-2.5 border-t ${selected.borderColor} flex items-center justify-between text-xs`}
        >
          {trend ? (
            <div className="flex items-center gap-1.5 truncate">
              {trend.direction === "up" ? (
                <span className="flex items-center text-emerald-600 font-semibold gap-0.5 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {trend.value}
                </span>
              ) : trend.direction === "down" ? (
                <span className="flex items-center text-rose-600 font-semibold gap-0.5 shrink-0">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {trend.value}
                </span>
              ) : (
                <span className="flex items-center text-[#475569] font-semibold gap-0.5 shrink-0">
                  <Minus className="w-3.5 h-3.5" />
                  {trend.value}
                </span>
              )}
              {trend.label && (
                <span className="text-[#64748B] truncate">{trend.label}</span>
              )}
            </div>
          ) : (
            <span className="text-[#475569] text-xs font-medium truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
