import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "blue"
    | "gold"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "cyan"
    | "outline";
  size?: "sm" | "md";
}

export function Badge({
  children,
  className = "",
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles = {
    default: "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]",
    blue: "bg-[#EEF2FF] text-[#4F75FF] border border-[#E0EAFF] font-semibold",
    gold: "bg-[#FEF9C3] text-[#A16207] border border-[#FEF08A] font-semibold",
    success:
      "bg-[#E6FBF5] text-[#00B788] border border-[#A7F3D0] font-semibold",
    warning:
      "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] font-semibold",
    danger: "bg-[#FEE2E2] text-[#EF4444] border border-[#FECACA] font-semibold",
    purple: "bg-[#F3E8FF] text-[#7356F1] border border-[#E9D5FF] font-semibold",
    cyan: "bg-[#E0F7FE] text-[#0284C7] border border-[#BAE6FD] font-semibold",
    outline: "bg-white text-[#64748B] border border-[#E2E8F0]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide transition-colors select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
