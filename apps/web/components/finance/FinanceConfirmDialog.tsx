"use client";

import React from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      maxWidth="md"
      title={title}
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              isDanger
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : "bg-[#EEF2FF] text-[#4F75FF] border border-[#E0E7FF]"
            } shrink-0`}
          >
            {isDanger ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <HelpCircle className="w-5 h-5" />
            )}
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed mt-1">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EDF2F7]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant={isDanger ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
          >
            Xác nhận
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
