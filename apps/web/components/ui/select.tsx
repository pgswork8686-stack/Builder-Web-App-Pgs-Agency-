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
            className="block text-xs font-bold text-[#475569]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-xl bg-[#F8F9FC] border border-[#DDDFEA] text-[#202333] text-sm outline-none transition-all duration-150 focus:bg-white focus:border-[#6044E8] focus:ring-2 focus:ring-[#6044E8]/20 disabled:bg-[#F4F2FD] disabled:text-[#64748B] disabled:cursor-not-allowed pl-4 pr-10 py-2.5 sm:py-3 min-h-11 ${
              error
                ? "border-[#FF785A] focus:border-[#FF785A] focus:ring-[#FF785A]/20"
                : ""
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3.5 pointer-events-none text-[#64748B]">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = "Select";
