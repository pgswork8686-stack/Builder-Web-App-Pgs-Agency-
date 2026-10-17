"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateKanban } from "@/components/tasks/aggregate-kanban";

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
      <AggregateKanban />
    </div>
  );
}
