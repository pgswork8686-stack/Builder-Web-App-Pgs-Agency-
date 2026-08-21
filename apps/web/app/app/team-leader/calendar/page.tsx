"use client";

import React from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { MonthCalendar } from "@/components/ui/month-calendar";

export default function TeamLeaderCalendarPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Công tác & Deadline (Team Calendar)"
        description="Lịch làm việc của đội nhóm, các mốc giao nộp sản phẩm và lịch họp dự án."
        badge="Lịch nhóm"
      />
      <MonthCalendar />
    </div>
  );
}
