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
      bg: "bg-sky-950/40 border-sky-500/30 text-sky-200",
      icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
      titleColor: "text-sky-300",
    },
    success: {
      bg: "bg-emerald-950/40 border-emerald-500/30 text-emerald-200",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      titleColor: "text-emerald-300",
    },
    warning: {
      bg: "bg-amber-950/40 border-amber-500/30 text-amber-200",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      titleColor: "text-amber-300",
    },
    error: {
      bg: "bg-rose-950/40 border-rose-500/30 text-rose-200",
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      titleColor: "text-rose-300",
    },
  };

  const selected = config[type];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3.5 p-4 rounded-2xl border backdrop-blur-sm ${selected.bg} ${className}`}
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
