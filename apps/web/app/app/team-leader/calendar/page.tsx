"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { MonthCalendar } from "@/components/ui/month-calendar";

export default function TeamLeaderCalendarPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="team_leader"
        activeView="calendar"
        title="Lịch Công tác & Deadline (Team Calendar)"
        description="Lịch làm việc của đội nhóm, các mốc giao nộp sản phẩm và lịch họp dự án."
        badge="Lịch nhóm"
      />
      <MonthCalendar />
    </div>
  );
}
