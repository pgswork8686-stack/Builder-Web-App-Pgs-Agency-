"use client";

import React from "react";
import { FolderOpen, Download } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu Bàn giao Dự án (Handover Documents)"
        description="Kho lưu trữ source code, tài liệu thiết kế, tài khoản và biên bản nghiệm thu hợp đồng."
        badge="Tài liệu bàn giao"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có tài liệu bàn giao nào"
          description="Tất cả các tài liệu chính thức sẽ được cập nhật sau khi nghiệm thu từng giai đoạn."
        />
      </Card>
    </div>
  );
}
