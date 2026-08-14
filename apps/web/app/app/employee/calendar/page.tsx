"use client";

import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";

export default function EmployeeCalendarPage() {
  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Làm việc Cá nhân (My Schedule)"
        description="Lịch làm việc cá nhân, ca trực, ngày nghỉ phép và deadline các công việc được giao."
        badge="Lịch cá nhân"
      />

      <Card className="p-6">
        <div className="grid grid-cols-7 gap-2 text-center pb-3 border-b border-[#EDF2F7]">
          {daysOfWeek.map((d) => (
            <span key={d} className="text-xs font-bold text-[#7C879D]">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 pt-3">
          {daysInMonth.map((day) => (
            <div
              key={day}
              className={`min-h-[70px] p-2 rounded-xl border border-[#EDF2F7] flex flex-col justify-between ${
                day === 14 ? "bg-[#EEF2FF] border-[#5D87FF]" : "bg-[#F6F8FC]"
              }`}
            >
              <span
                className={`text-xs font-bold ${day === 14 ? "text-[#5D87FF]" : "text-[#24304A]"}`}
              >
                {day}
              </span>
              {day === 14 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#5D87FF] text-white truncate">
                  Hôm nay
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
