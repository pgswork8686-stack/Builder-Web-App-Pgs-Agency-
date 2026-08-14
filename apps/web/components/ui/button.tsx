import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "gold"
    | "gold-outline";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F75FF] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer rounded-xl";

    const sizeStyles = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-xs sm:text-sm gap-2",
      lg: "h-12 px-6 text-sm sm:text-base gap-2.5",
      icon: "h-9 w-9 p-0 shrink-0",
    };

    const variantStyles = {
      primary:
        "bg-[#4F75FF] text-white hover:bg-[#3D62EE] shadow-sm active:scale-[0.98]",
      secondary:
        "bg-[#F1F5F9] text-[#1E293B] hover:bg-[#E2E8F0] border border-[#E2E8F0] active:scale-[0.98]",
      outline:
        "bg-white text-[#1E293B] border border-[#E2E8F0] hover:bg-[#F8FAFC] active:scale-[0.98]",
      gold: "bg-[#FFB800] text-black hover:brightness-105 shadow-sm active:scale-[0.98]",
      "gold-outline":
        "bg-[#FEF9C3] text-[#A16207] border border-[#FDE047] hover:bg-[#FEF08A] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] active:scale-[0.98]",
      danger:
        "bg-[#FF785A] text-white hover:brightness-110 shadow-sm active:scale-[0.98]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
