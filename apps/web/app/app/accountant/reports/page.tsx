"use client";

import React from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AccountantReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Báo cáo Tài chính Kế toán (Financial Reports)"
        description="Báo cáo kết quả kinh doanh, bảng cân đối kế toán và dòng tiền định kỳ."
        badge="Báo cáo"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Xuất báo cáo tài chính
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Doanh thu
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Theo dõi Hợp đồng
          </h4>
          <p className="text-xs text-[#7C879D]">
            Doanh thu ghi nhận theo từng khách hàng và dự án.
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Công nợ
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Tuổi nợ & Hóa đơn
          </h4>
          <p className="text-xs text-[#7C879D]">
            Phân tích công nợ đến hạn và các khoản quá hạn.
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Báo cáo Chi phí
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Chi phí Hoạt động
          </h4>
          <p className="text-xs text-[#7C879D]">
            Tổng hợp chi phí vận hành và lương nhân sự.
          </p>
        </Card>
      </div>
    </div>
  );
}
