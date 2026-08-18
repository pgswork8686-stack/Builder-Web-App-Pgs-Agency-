"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MonthCalendarProps {
  highlightSunday?: boolean;
}

export function MonthCalendar({ highlightSunday = true }: MonthCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // First weekday of month (0=Sun, convert to Mon-based: Mon=0...Sun=6)
  const firstDayRaw = new Date(year, month, 1).getDay();
  const startOffset = (firstDayRaw + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const trailingCells =
    (startOffset + daysInMonth) % 7 === 0
      ? 0
      : 7 - ((startOffset + daysInMonth) % 7);

  const monthLabel = `Tháng ${month + 1}, ${year}`;
  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Trước
        </Button>
        <span className="text-sm font-extrabold text-[#24304A]">
          {monthLabel}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Sau
        </Button>
      </div>

      <Card className="p-4 sm:p-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-3 border-b border-[#EDF2F7]">
          {daysOfWeek.map((d) => (
            <span
              key={d}
              className={`text-xs font-bold ${
                highlightSunday && d === "CN"
                  ? "text-rose-400"
                  : "text-[#7C879D]"
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-3">
          {/* Leading blanks */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`s${i}`} className="min-h-[60px] sm:min-h-[80px]" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const colIndex = (startOffset + day - 1) % 7;
            const isSunday = colIndex === 6;
            const todayCell = isToday(day);
            return (
              <div
                key={day}
                className={`min-h-[60px] sm:min-h-[80px] p-1.5 sm:p-2 rounded-xl border flex flex-col gap-1 transition-colors cursor-default ${
                  todayCell
                    ? "bg-[#EEF2FF] border-[#5D87FF]"
                    : "bg-[#F6F8FC] border-[#EDF2F7] hover:bg-white hover:border-[#CBD5E1]"
                }`}
              >
                <span
                  className={`text-xs font-bold ${
                    todayCell
                      ? "text-[#5D87FF]"
                      : highlightSunday && isSunday
                        ? "text-rose-400"
                        : "text-[#24304A]"
                  }`}
                >
                  {day}
                </span>
                {todayCell && (
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#5D87FF] text-white w-fit truncate">
                    Hôm nay
                  </span>
                )}
              </div>
            );
          })}

          {/* Trailing blanks */}
          {Array.from({ length: trailingCells }).map((_, i) => (
            <div key={`e${i}`} className="min-h-[60px] sm:min-h-[80px]" />
          ))}
        </div>
      </Card>
    </div>
  );
}
