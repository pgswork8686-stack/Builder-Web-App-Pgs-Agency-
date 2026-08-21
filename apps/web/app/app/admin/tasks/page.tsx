"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ListTodo,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminTasksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Danh sách Công việc (Tasks Master)"
        description="Quản lý và điều phối tất cả các đầu việc trong toàn bộ các dự án của agency."
        badge="Tổng công việc"
        action={
          <div className="flex items-center gap-2">
            <Link href="/app/admin/kanban">
              <Button variant="secondary" size="sm">
                Mở bảng Kanban
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7C879D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm công việc, người thực hiện..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] focus:outline-none focus:border-[#5D87FF]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-[#24304A] focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="todo">Cần làm</option>
            <option value="in_progress">Đang làm</option>
            <option value="review">Chờ duyệt</option>
            <option value="done">Hoàn thành</option>
          </select>
        </div>
      </div>

      <Card className="p-10 text-center">
        <EmptyState
          icon={<ListTodo className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có công việc nào trong danh sách"
          description="Các đầu việc được tạo trong từng dự án sẽ hiển thị tập trung tại đây."
        />
      </Card>
    </div>
  );
}
