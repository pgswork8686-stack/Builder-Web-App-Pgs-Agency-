import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export interface StateBannerProps {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function StateBanner({
  type = "info",
  title,
  message,
  onDismiss,
  action,
  className = "",
}: StateBannerProps) {
  const config = {
    info: {
      bg: "bg-[#F0F9FF] border-[#BAE6FD] text-[#0C4A6E]",
      icon: <Info className="w-5 h-5 text-[#0369A1] shrink-0" />,
      titleColor: "text-[#0C4A6E]",
    },
    success: {
      bg: "bg-[#ECFDF5] border-[#A7F3D0] text-[#064E3B]",
      icon: <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0" />,
      titleColor: "text-[#064E3B]",
    },
    warning: {
      bg: "bg-[#FFFBEB] border-[#FDE68A] text-[#78350F]",
      icon: <AlertTriangle className="w-5 h-5 text-[#92400E] shrink-0" />,
      titleColor: "text-[#78350F]",
    },
    error: {
      bg: "bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]",
      icon: <AlertCircle className="w-5 h-5 text-[#B91C1C] shrink-0" />,
      titleColor: "text-[#7F1D1D]",
    },
  };

  const selected = config[type];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3.5 p-4 rounded-2xl border ${selected.bg} ${className}`}
    >
      <div className="mt-0.5">{selected.icon}</div>
      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <h5
            className={`text-sm font-bold tracking-tight ${selected.titleColor}`}
          >
            {title}
          </h5>
        )}
        <div className="text-xs leading-relaxed opacity-90">{message}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-[#8E8E93] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
