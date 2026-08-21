"use client";

import React from "react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { MonthCalendar } from "@/components/ui/month-calendar";

export default function EmployeeCalendarPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Làm việc Cá nhân (My Schedule)"
        description="Lịch làm việc cá nhân, ca trực, ngày nghỉ phép và deadline các công việc được giao."
        badge="Lịch cá nhân"
      />
      <MonthCalendar />
    </div>
  );
}
