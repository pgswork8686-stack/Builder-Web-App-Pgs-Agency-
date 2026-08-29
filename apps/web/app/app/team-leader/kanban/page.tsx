"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";

export default function TeamLeaderKanbanPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="team_leader"
        activeView="kanban"
        title="Bảng Kanban Quản lý Nhóm (Team Board)"
        description="Theo dõi luồng công việc của đội nhóm theo các trạng thái thực hiện."
        badge="Kanban"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[450px]">
        {["Cần làm", "Đang làm", "Chờ duyệt", "Hoàn thành"].map((col) => (
          <div
            key={col}
            className="p-4 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] flex flex-col space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
              <span className="text-xs font-bold text-[#161827]">{col}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#7C879D]">
                0
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-[#EDF2F7] rounded-xl text-center">
              <span className="text-xs text-[#7C879D]">Trống</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
