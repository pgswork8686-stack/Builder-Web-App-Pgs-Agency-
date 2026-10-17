"use client";

import React from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { AggregateCalendar } from "@/components/tasks/aggregate-calendar";

export default function EmployeeCalendarPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Làm việc Cá nhân (My Schedule)"
        description="Deadline các công việc được giao cho bạn và lịch nghỉ lễ của công ty."
        badge="Lịch cá nhân"
      />
      <AggregateCalendar onlyMine />
    </div>
  );
}
