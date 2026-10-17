"use client";

import React from "react";
import { TaskModuleHeader } from "@/components/tasks/task-module-header";
import { AggregateTaskList } from "@/components/tasks/aggregate-task-list";

export default function TeamLeaderTasksPage() {
  return (
    <div className="space-y-6">
      <TaskModuleHeader
        role="team_leader"
        activeView="list"
        title="Danh sách Công việc của Nhóm (Team Tasks)"
        description="Theo dõi các đầu việc trong những dự án mà bạn tham gia."
        badge="Danh sách"
      />
      <AggregateTaskList />
    </div>
  );
}
