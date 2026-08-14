"use client";

import React from "react";
import { FileText, Download } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function EmployeePayrollPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Phiếu Lương Cá nhân (My Payslips)"
        description="Tra cứu chi tiết phiếu lương hàng tháng, các khoản khấu trừ và bảo hiểm."
        badge="Phiếu lương"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FileText className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có phiếu lương nào được phát hành"
          description="Phiếu lương tháng sẽ hiển thị sau khi bộ phận Kế toán chốt kỳ thanh toán lương."
        />
      </Card>
    </div>
  );
}
