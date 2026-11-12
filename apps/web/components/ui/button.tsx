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
      "inline-flex whitespace-nowrap items-center justify-center font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#7257F5] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer rounded-lg";

    const sizeStyles = {
      sm: "h-11 sm:h-8 px-3 text-sm sm:text-xs gap-1.5",
      md: "h-11 sm:h-9 px-3.5 text-sm gap-2",
      lg: "h-12 sm:h-11 px-5 text-sm gap-2",
      icon: "h-11 w-11 sm:h-9 sm:w-9 p-0 shrink-0",
    };

    const variantStyles = {
      primary:
        "bg-[#7257F5] text-white hover:bg-[#6044E8] shadow-xs active:scale-[0.98]",
      secondary:
        "bg-white text-[#202333] hover:bg-[#F8F9FC] border border-[#DDDFEA] active:scale-[0.98]",
      outline:
        "bg-white text-[#202333] border border-[#DDDFEA] hover:bg-[#F2EEFF] hover:border-[#7257F5] active:scale-[0.98]",
      gold: "bg-[#7257F5] text-white hover:bg-[#6044E8] shadow-xs active:scale-[0.98]",
      "gold-outline":
        "bg-[#F2EEFF] text-[#5B3FD6] border border-[#DDD5FF] hover:bg-[#E7E0FF] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[#475569] hover:text-[#202333] hover:bg-[#F4F2FD] active:scale-[0.98]",
      danger:
        "bg-[#D92D20] text-white hover:bg-[#B42318] shadow-xs active:scale-[0.98]",
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
