import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className = "", label, error, helperText, id, children, ...props },
    ref,
  ) => {
    const selectId =
      id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#475569]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm outline-none transition-all duration-150 focus:bg-white focus:border-[#4F75FF] focus:ring-2 focus:ring-[#4F75FF]/20 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:cursor-not-allowed pl-4 pr-10 py-2.5 sm:py-3 ${
              error
                ? "border-[#FF785A] focus:border-[#FF785A] focus:ring-[#FF785A]/20"
                : ""
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3.5 pointer-events-none text-[#94A3B8]">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <p className="text-xs text-[#FF785A]">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
