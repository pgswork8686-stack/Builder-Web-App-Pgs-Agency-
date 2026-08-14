"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Clock,
  Calculator,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantPayrollPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bảng Lương Doanh Nghiệp (Payroll Reconciliation)"
        description="Tính toán và chốt bảng thanh toán lương dựa trên dữ liệu công chuẩn và phụ cấp dự án."
        badge="Tháng 8/2026"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
            >
              Xuất bảng lương
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Calculator className="w-4 h-4" />}
            >
              Tính toán tự động
            </Button>
          </div>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FileSpreadsheet className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa chốt dữ liệu bảng lương tháng 8/2026"
          description="Bảng lương sẽ được tự động tổng hợp sau khi toàn bộ dữ liệu chấm công được đối soát."
        />
      </Card>
    </div>
  );
}
