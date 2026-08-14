"use client";

import React from "react";
import { FileSpreadsheet, Download } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeamLeaderReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Báo cáo Tiến độ Đội nhóm"
        description="Tổng hợp năng suất, tỷ lệ hoàn thành tasks và đánh giá chất lượng dự án của nhóm."
        badge="Báo cáo nhóm"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Xuất báo cáo nhóm
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Hiệu suất Công việc
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Tỷ lệ hoàn thành Tasks
          </h4>
          <p className="text-xs text-[#7C879D]">
            Thống kê các đầu việc đúng hạn và các task bị trễ hạn.
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs font-bold text-[#7C879D]">
            Chấm công Đội ngũ
          </span>
          <h4 className="text-base font-extrabold text-[#24304A]">
            Chuyên cần Thành viên
          </h4>
          <p className="text-xs text-[#7C879D]">
            Theo dõi giờ vào ca, ngày nghỉ phép của thành viên trong nhóm.
          </p>
        </Card>
      </div>
    </div>
  );
}
