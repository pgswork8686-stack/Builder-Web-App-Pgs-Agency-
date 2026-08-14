"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldAlert } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function SessionExpiredModal({
  isOpen,
  onClose,
}: SessionExpiredModalProps) {
  const router = useRouter();

  const handleRedirectLogin = () => {
    if (onClose) onClose();
    router.replace("/auth/login");
  };

  return (
    <Dialog isOpen={isOpen} onClose={() => {}} maxWidth="sm">
      <div className="flex flex-col items-center text-center space-y-4 pt-2">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
            Phiên đăng nhập hết hạn
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed max-w-xs mx-auto">
            Để đảm bảo an toàn thông tin doanh nghiệp, vui lòng đăng nhập lại để
            tiếp tục phiên làm việc.
          </p>
        </div>

        <div className="w-full pt-3 border-t border-[#EDF2F7]">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={handleRedirectLogin}
            rightIcon={<LogIn className="w-4 h-4" />}
          >
            Đăng nhập lại
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
