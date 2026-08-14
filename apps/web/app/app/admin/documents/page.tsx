"use client";

import React, { useState } from "react";
import { FolderOpen, FileText, Upload, Plus, Search } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Thư viện Tài liệu PGS (Documents & Templates)"
        description="Kho tài liệu biểu mẫu, hợp đồng mẫu, quy trình nội bộ và hướng dẫn vận hành chuẩn."
        badge="PGS Library"
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

      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] flex items-center gap-3 shadow-xs">
        <Search className="w-4 h-4 text-[#7C879D]" />
        <input
          type="text"
          placeholder="Tìm kiếm tài liệu, quy trình, biểu mẫu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-[#24304A] bg-transparent border-none outline-none placeholder:text-[#7C879D]"
        />
      </div>

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderOpen className="w-10 h-10 text-[#7C879D]" />}
          title="Thư viện chưa có tài liệu"
          description="Tải lên tài liệu đầu tiên để chia sẻ trong nội bộ PGS Agency."
        />
      </Card>
    </div>
  );
}
