"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";

export default function AdminKanbanPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="admin"
        activeView="kanban"
        title="Bảng Kanban Tổng hợp"
        description="Theo dõi luồng xử lý công việc trực quan theo các cột trạng thái dự án."
        badge="Kanban"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[450px]">
        {[
          "Cần làm",
          "Đang thực hiện",
          "Chờ nghiệm thu",
          "Hoàn tất",
        ].map((col) => (
          <div
            key={col}
            className="p-4 rounded-2xl bg-[#FFFBF0] border border-[#F2EAD3] flex flex-col space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F2EAD3]">
              <span className="text-xs font-bold text-[#161827]">{col}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#475569] border border-[#F2EAD3]">
                0
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-[#F2EAD3] rounded-xl text-center">
              <span className="text-xs text-[#475569]">Trống</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
