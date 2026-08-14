"use client";

import React, { useState } from "react";
import { ListTodo, Search } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function EmployeeTasksPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Nhiệm vụ của tôi (My Assigned Tasks)"
        description="Danh sách các công việc cá nhân được phân công thực hiện theo từng dự án."
        badge="Nhiệm vụ cá nhân"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<ListTodo className="w-10 h-10 text-[#7C879D]" />}
          title="Bạn không có nhiệm vụ nào cần làm"
          description="Các đầu việc được giao sẽ hiển thị tại đây kèm thời hạn hoàn thành."
        />
      </Card>
    </div>
  );
}
