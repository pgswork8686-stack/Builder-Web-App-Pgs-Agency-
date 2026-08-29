"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { MonthCalendar } from "@/components/ui/month-calendar";

export default function AdminCalendarPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="admin"
        activeView="calendar"
        title="Lịch Tổng hợp Công việc (Master Calendar)"
        description="Theo dõi lịch bàn giao dự án, deadline công việc và các sự kiện công ty."
        badge="Lịch biểu"
      />
      <MonthCalendar />
    </div>
  );
}
