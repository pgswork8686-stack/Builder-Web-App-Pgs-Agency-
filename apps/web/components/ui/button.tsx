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
      "inline-flex items-center justify-center font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7AE18] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer rounded-xl";

    const sizeStyles = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-xs sm:text-sm gap-2",
      lg: "h-12 px-6 text-sm sm:text-base gap-2.5",
      icon: "h-9 w-9 p-0 shrink-0",
    };

    const variantStyles = {
      primary:
        "bg-[#E7AE18] text-[#161827] hover:bg-[#CC9410] shadow-xs active:scale-[0.98]",
      secondary:
        "bg-white text-[#161827] hover:bg-[#F8FAFC] border border-[#E2E8F0] active:scale-[0.98]",
      outline:
        "bg-white text-[#161827] border border-[#E2E8F0] hover:bg-[#FFF8E5] hover:border-[#E7AE18] active:scale-[0.98]",
      gold: "bg-[#E7AE18] text-[#161827] hover:bg-[#CC9410] shadow-xs active:scale-[0.98]",
      "gold-outline":
        "bg-[#FFF8E5] text-[#9A7000] border border-[#FDE68A] hover:bg-[#FEF08A] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[#64748B] hover:text-[#161827] hover:bg-[#F1F5F9] active:scale-[0.98]",
      danger:
        "bg-[#FF785A] text-white hover:brightness-110 shadow-xs active:scale-[0.98]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && (
          <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children !== undefined && children !== null && (
          <span className="inline-flex items-center">{children}</span>
        )}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
