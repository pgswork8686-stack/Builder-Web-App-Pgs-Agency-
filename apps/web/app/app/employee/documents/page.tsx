"use client";

import React from "react";
import { FolderOpen } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function EmployeeDocumentsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu & Quy trình Doanh nghiệp (PGS Library)"
        description="Tra cứu tài liệu quy định công ty, hướng dẫn chế độ phúc lợi và tài liệu đào tạo nội bộ."
        badge="Tài liệu"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có tài liệu dùng chung nào"
          description="Các tài liệu hướng dẫn và quy định mới sẽ được công bố tại đây."
        />
      </Card>
    </div>
  );
}
