import React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemName?: string;
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận xóa dữ liệu",
  description = "Thao tác này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?",
  itemName,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col items-center text-center space-y-4 pt-2">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
          {itemName && (
            <p className="text-xs font-mono font-bold text-[#0F172A] bg-[#F8FAFC] p-2 rounded-xl border border-[#E2E8F0] mt-2 truncate">
              {itemName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 w-full pt-3 border-t border-[#EDF2F7]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            Xóa vĩnh viễn
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
