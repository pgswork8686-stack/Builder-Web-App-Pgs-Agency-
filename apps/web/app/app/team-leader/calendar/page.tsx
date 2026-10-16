"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateCalendar } from "@/components/tasks/aggregate-calendar";

export default function TeamLeaderCalendarPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="team_leader"
        activeView="calendar"
        title="Lịch Công tác & Deadline (Team Calendar)"
        description="Deadline công việc trong các dự án bạn tham gia và lịch nghỉ lễ của công ty."
        badge="Lịch nhóm"
      />
      <AggregateCalendar />
    </div>
  );
}
