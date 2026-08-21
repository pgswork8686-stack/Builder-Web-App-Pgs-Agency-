"use client";

import React from "react";
import Link from "next/link";
import { Kanban as KanbanIcon, Plus, FolderKanban } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminKanbanPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bảng Kanban Tổng hợp (Master Board)"
        description="Theo dõi luồng xử lý công việc trực quan theo các cột trạng thái dự án."
        badge="Kanban View"
        action={
          <Link href="/app/admin/tasks">
            <Button variant="secondary" size="sm">
              Xem dạng danh sách
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[450px]">
        {[
          "Cần làm (To Do)",
          "Đang thực hiện (In Progress)",
          "Chờ nghiệm thu (Review)",
          "Hoàn tất (Done)",
        ].map((col) => (
          <div
            key={col}
            className="p-4 rounded-2xl bg-[#F6F8FC] border border-[#EDF2F7] flex flex-col space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#EDF2F7]">
              <span className="text-xs font-bold text-[#24304A]">{col}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#7C879D] border border-[#EDF2F7]">
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
