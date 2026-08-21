"use client";

import React from "react";
import { FolderOpen, Search, Upload } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderDocumentsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tài liệu PGS & Biểu mẫu Nhóm"
        description="Kho quy trình bàn giao, tài liệu hướng dẫn kỹ thuật và biểu mẫu đánh giá của agency."
        badge="Tài liệu"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Tải lên tài liệu
          </Button>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có tài liệu nào trong thư viện"
          description="Tài liệu hướng dẫn và quy trình dự án sẽ được hiển thị tại đây."
        />
      </Card>
    </div>
  );
}
