"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ListTodo, Search, Filter } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderTasksPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Danh sách Công việc của Nhóm (Team Tasks)"
        description="Theo dõi toàn bộ các đầu việc được giao cho thành viên trong team."
        badge="Công việc"
        action={
          <Link href="/app/team-leader/kanban">
            <Button variant="secondary" size="sm">
              Mở bảng Kanban
            </Button>
          </Link>
        }
      />

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
