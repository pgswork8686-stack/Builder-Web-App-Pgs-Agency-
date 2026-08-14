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
  const variantStyles = {
    default: {
      bg: "bg-white border-[#EDF2F7] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]",
      iconBg: "bg-[#EEF2FF] text-[#4F75FF] border-[#E0EAFF]",
      titleColor: "text-[#64748B]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#EDF2F7]",
    },
    blue: {
      bg: "bg-[#EEF2FF] border-[#E0EAFF] shadow-xs",
      iconBg: "bg-white text-[#4F75FF] shadow-xs",
      titleColor: "text-[#4F75FF]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#E0EAFF]",
    },
    cyan: {
      bg: "bg-[#E0F7FE] border-[#BAE6FD] shadow-xs",
      iconBg: "bg-white text-[#0284C7] shadow-xs",
      titleColor: "text-[#0284C7]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#BAE6FD]",
    },
    gold: {
      bg: "bg-[#FEF9C3] border-[#FEF08A] shadow-xs",
      iconBg: "bg-white text-[#CA8A04] shadow-xs",
      titleColor: "text-[#CA8A04]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#FEF08A]",
    },
    green: {
      bg: "bg-[#E6FBF5] border-[#A7F3D0] shadow-xs",
      iconBg: "bg-white text-[#059669] shadow-xs",
      titleColor: "text-[#059669]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#A7F3D0]",
    },
    purple: {
      bg: "bg-[#F3E8FF] border-[#E9D5FF] shadow-xs",
      iconBg: "bg-white text-[#9333EA] shadow-xs",
      titleColor: "text-[#9333EA]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#E9D5FF]",
    },
    rose: {
      bg: "bg-[#FEE2E2] border-[#FECACA] shadow-xs",
      iconBg: "bg-white text-[#DC2626] shadow-xs",
      titleColor: "text-[#DC2626]",
      valueColor: "text-[#0F172A]",
      borderColor: "border-[#FECACA]",
    },
  };

  const selected = variantStyles[variant] || variantStyles.default;

  // Auto-adjust font size for text vs short numbers
  const valStr = String(value);
  const isLongText = valStr.length > 6;
  const isMediumText = valStr.length > 4;

  const valueFontSize = isLongText
    ? "text-lg sm:text-xl font-bold leading-tight"
    : isMediumText
      ? "text-xl sm:text-2xl font-black tracking-tight"
      : "text-2xl sm:text-3xl font-black tracking-tight";

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 sm:p-5 relative overflow-hidden transition-all duration-200 flex flex-col justify-between h-full ${
        selected.bg
      } ${
        onClick
          ? "cursor-pointer active:scale-[0.99] hover:shadow-md"
          : "hover:shadow-xs"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${selected.titleColor} truncate`}
            >
              {title}
            </span>
            {badge && (
              <Badge variant="gold" size="sm">
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
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${selected.iconBg}`}
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
                <span className="flex items-center text-[#64748B] font-semibold gap-0.5 shrink-0">
                  <Minus className="w-3.5 h-3.5" />
                  {trend.value}
                </span>
              )}
              {trend.label && (
                <span className="text-[#94A3B8] truncate">{trend.label}</span>
              )}
            </div>
          ) : (
            <span className="text-[#64748B] text-[11px] font-medium truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
