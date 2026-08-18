"use client";

import React from "react";
import { FileSpreadsheet, Lock, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantPayrollPage() {
  const currentMonthStr = `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bảng Lương Doanh Nghiệp (Payroll Reconciliation)"
        description="Tính toán và chốt bảng thanh toán lương dựa trên dữ liệu công chuẩn và phụ cấp dự án."
        badge={currentMonthStr}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled
              leftIcon={<Lock className="w-4 h-4" />}
            >
              Xuất bảng lương
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled
              leftIcon={<Lock className="w-4 h-4" />}
            >
              Tính toán tự động
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong>Chức năng bảng lương chưa được kết nối backend:</strong> Hệ
          thống tính lương tự động chưa có module API backend. Bảng lương hiện
          tại sẽ hiển thị trạng thái chuẩn khi được tích hợp.
        </span>
      </div>

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FileSpreadsheet className="w-10 h-10 text-[#7C879D]" />}
          title={`Chưa chốt dữ liệu bảng lương ${currentMonthStr.toLowerCase()}`}
          description="Chức năng bảng lương chưa được kết nối API backend. Dữ liệu chuyên cần thực tế có thể tra cứu tại mục Chấm công."
        />
      </Card>
    </div>
  );
}
