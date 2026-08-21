"use client";

import React from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientMeetingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Họp & Trao đổi Dự án (Meetings Schedule)"
        description="Lịch trình các buổi họp nghiệm thu, demo sản phẩm và làm việc với ban dự án PGS."
        badge="Lịch họp"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<CalendarIcon className="w-10 h-10 text-[#7C879D]" />}
          title="Không có lịch họp nào sắp diễn ra"
          description="Khi có cuộc họp mới được xếp lịch, thông báo và đường dẫn họp online sẽ hiển thị tại đây."
        />
      </Card>
    </div>
  );
}
