import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      label,
      error,
      leftIcon,
      rightIcon,
      helperText,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId =
      id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-[#475569]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#64748B] pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl bg-[#FFFBF0] border border-[#E8DDB8] text-[#161827] text-sm placeholder-[#94A3B8] outline-none transition-all duration-150 focus:bg-white focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 disabled:bg-[#FBF3DC] disabled:text-[#64748B] disabled:cursor-not-allowed ${
              leftIcon ? "pl-10" : "pl-4"
            } ${rightIcon ? "pr-10" : "pr-4"} py-2.5 sm:py-3 ${
              error
                ? "border-[#FF785A] focus:border-[#FF785A] focus:ring-[#FF785A]/20"
                : ""
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-[#64748B]">{rightIcon}</div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#B91C1C]">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#475569]">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
