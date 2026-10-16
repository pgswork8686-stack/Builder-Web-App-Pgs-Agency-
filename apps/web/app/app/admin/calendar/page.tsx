"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateCalendar } from "@/components/tasks/aggregate-calendar";

export default function AdminCalendarPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="admin"
        activeView="calendar"
        title="Lịch Tổng hợp Công việc (Master Calendar)"
        description="Theo dõi deadline công việc và các ngày nghỉ lễ, ngày làm bù của công ty."
        badge="Lịch biểu"
      />
      <AggregateCalendar />
    </div>
  );
}
