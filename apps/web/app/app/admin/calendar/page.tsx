"use client";

import React from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { MonthCalendar } from "@/components/ui/month-calendar";

export default function AdminCalendarPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Tổng hợp (Master Calendar)"
        description="Theo dõi lịch bàn giao dự án, deadline công việc và các sự kiện công ty."
        badge="Lịch biểu"
      />
      <MonthCalendar />
    </div>
  );
}
