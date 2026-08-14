"use client";

import React from "react";
import { FolderOpen, FileText, Upload, Search } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantVouchersPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Chứng từ Kế toán (Vouchers & Receipts)"
        description="Lưu trữ hóa đơn điện tử, ủy nhiệm chi và chứng từ thanh toán thuế doanh nghiệp."
        badge="Chứng từ"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Tải lên chứng từ
          </Button>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
          title="Kho chứng từ hiện đang trống"
          description="Tải lên tệp chứng từ đầu tiên để lưu trữ bảo mật trên hệ thống."
        />
      </Card>
    </div>
  );
}
