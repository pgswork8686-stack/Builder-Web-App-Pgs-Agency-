"use client";

import React from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FinanceConfirmDialog({
  isOpen,
  title,
  message,
  isDanger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0E0E0F] border border-[#151516] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl ${
              isDanger
                ? "bg-[#FF1744]/10 text-[#FF1744]"
                : "bg-[#FFC400]/10 text-[#FFC400]"
            } shrink-0`}
          >
            {isDanger ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <HelpCircle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">{title}</h4>
            <p className="text-xs text-[#FFF8E6]/70 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-[#151516] border border-transparent hover:border-[#1f1f22] text-[#606060] hover:text-white transition-colors cursor-pointer text-xs font-bold"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-black hover:brightness-110 font-bold transition-all cursor-pointer text-xs ${
              isDanger ? "bg-[#FF1744] text-white" : "bg-[#FFC400]"
            }`}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
