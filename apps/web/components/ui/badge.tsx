import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "brand"
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
    default: "bg-[#FBF3DC] text-[#475569] border border-[#E8DDB8] font-bold",
    brand:
      "bg-[#FFF8E5] text-[#8A6400] border border-[#FDE68A] font-bold shadow-2xs",
    blue: "bg-[#EEF2FF] text-[#3B5BDB] border border-[#E0EAFF] font-bold",
    gold: "bg-[#FFF8E5] text-[#8A6400] border border-[#FDE68A] font-bold",
    success:
      "bg-[#E6FBF5] text-[#047857] border border-[#A7F3D0] font-bold",
    warning:
      "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold",
    danger: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] font-bold",
    purple: "bg-[#F3E8FF] text-[#7356F1] border border-[#E9D5FF] font-bold",
    cyan: "bg-[#E0F7FE] text-[#0284C7] border border-[#BAE6FD] font-bold",
    outline: "bg-white text-[#475569] border border-[#E8DDB8]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full font-medium tracking-wide transition-colors select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
