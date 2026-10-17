"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateTaskList } from "@/components/tasks/aggregate-task-list";

export default function AdminTasksPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="admin"
        activeView="list"
        title="Danh sách Công việc (Tasks Master)"
        description="Quản lý và điều phối tất cả các đầu việc trong toàn bộ các dự án của agency."
        badge="Danh sách"
      />
      <AggregateTaskList />
    </div>
  );
}
