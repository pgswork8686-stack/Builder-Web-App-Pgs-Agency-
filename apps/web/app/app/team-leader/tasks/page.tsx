"use client";

import React, { useState } from "react";
import { ListTodo, Search } from "lucide-react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderTasksPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="team_leader"
        activeView="list"
        title="Danh sách Công việc của Nhóm (Team Tasks)"
        description="Theo dõi toàn bộ các đầu việc được giao cho thành viên trong team."
        badge="Danh sách"
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#7C879D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc theo tên, người phụ trách..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none focus:border-[#E7AE18]"
          />
        </div>
      </div>

      <Card className="p-10 text-center">
        <EmptyState
          icon={<ListTodo className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có công việc nào trong danh sách"
          description="Tạo các công việc mới trong từng dự án để phân công cho thành viên."
        />
      </Card>
    </div>
  );
}
