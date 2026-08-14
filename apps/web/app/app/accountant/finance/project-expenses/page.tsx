"use client";

import React from "react";
import { FolderKanban, Plus, DollarSign } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantProjectExpensesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đề nghị & Chi phí Dự án (Project Expenses)"
        description="Kiểm soát chi phí phát sinh, mua tài nguyên và các đề nghị hoàn ứng theo từng dự án."
        badge="Chi phí dự án"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Tạo đề nghị chi phí
          </Button>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<FolderKanban className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có đề nghị chi phí dự án nào"
          description="Các khoản đề nghị chi phí được duyệt sẽ hiển thị tại đây."
        />
      </Card>
    </div>
  );
}
