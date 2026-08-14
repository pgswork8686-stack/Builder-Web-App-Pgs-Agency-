"use client";

import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState("Tháng 8, 2026");

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch Tổng hợp (Master Calendar)"
        description="Theo dõi lịch bàn giao dự án, deadline công việc và các sự kiện công ty."
        badge="Lịch biểu"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Trước
            </Button>
            <span className="text-xs font-bold text-[#24304A] px-3">
              {currentMonth}
            </span>
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Sau
            </Button>
          </div>
        }
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
              className={`min-h-[70px] sm:min-h-[90px] p-2 rounded-xl border border-[#EDF2F7] flex flex-col justify-between ${
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
