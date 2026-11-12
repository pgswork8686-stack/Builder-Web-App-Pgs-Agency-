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
    default: "bg-[#F4F2FD] text-[#475569] border border-[#DDDFEA]" ,
    brand:
      "bg-[#F2EEFF] text-[#5B3FD6] border border-[#DDD5FF]",
    blue: "bg-[#F2EEFF] text-[#6044E8] border border-[#E7E0FF]" ,
    gold: "bg-[#F2EEFF] text-[#5B3FD6] border border-[#DDD5FF]" ,
    success:
      "bg-[#ECFDF3] text-[#067647] border border-[#ABEFC6]" ,
    warning:
      "bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]" ,
    danger: "bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]" ,
    purple: "bg-[#F2EEFF] text-[#5B3FD6] border border-[#E9D5FF]" ,
    cyan: "bg-[#E0F7FE] text-[#0284C7] border border-[#BAE6FD]" ,
    outline: "bg-white text-[#475569] border border-[#DDDFEA]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full font-semibold transition-colors select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
