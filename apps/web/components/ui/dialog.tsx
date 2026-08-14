import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    "2xl": "max-w-4xl",
    "3xl": "max-w-5xl",
    "4xl": "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Box */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth] || "max-w-2xl"} rounded-3xl bg-white border border-[#EDF2F7] p-6 sm:p-8 text-[#24304A] shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150 my-auto`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-xl p-2 text-[#7C879D] hover:text-[#24304A] hover:bg-[#F6F8FC] transition-colors cursor-pointer"
          aria-label="Đóng dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {title && (
          <div className="mb-5 pr-8">
            <h3 className="text-lg sm:text-xl font-bold text-[#24304A] tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs sm:text-sm text-[#7C879D] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}
