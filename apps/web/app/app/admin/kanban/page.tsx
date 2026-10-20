"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateKanban } from "@/components/tasks/aggregate-kanban";

export default function AdminKanbanPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="admin"
        activeView="kanban"
        title="Bảng Kanban Tổng hợp (Master Board)"
        description="Theo dõi luồng xử lý công việc trực quan theo các cột trạng thái."
        badge="Kanban"
      />
      <AggregateKanban />
    </div>
  );
}
