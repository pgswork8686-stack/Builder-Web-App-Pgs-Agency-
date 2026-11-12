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
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles = {
    default: "bg-[#F4F2FD] text-[#475569] border border-[#DDDFEA] font-bold",
    brand:
      "bg-[#F2EEFF] text-[#5B3FD6] border border-[#DDD5FF] font-bold shadow-2xs",
    blue: "bg-[#F2EEFF] text-[#6044E8] border border-[#E7E0FF] font-bold",
    gold: "bg-[#F2EEFF] text-[#5B3FD6] border border-[#DDD5FF] font-bold",
    success:
      "bg-[#E6FBF5] text-[#047857] border border-[#A7F3D0] font-bold",
    warning:
      "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-bold",
    danger: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] font-bold",
    purple: "bg-[#F2EEFF] text-[#7257F5] border border-[#E9D5FF] font-bold",
    cyan: "bg-[#E0F7FE] text-[#0284C7] border border-[#BAE6FD] font-bold",
    outline: "bg-white text-[#475569] border border-[#DDDFEA]",
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
