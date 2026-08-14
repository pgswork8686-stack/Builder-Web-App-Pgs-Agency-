"use client";

import React from "react";
import { UserCheck, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientApprovalsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sản phẩm Chờ duyệt (Deliverables Review)"
        description="Kiểm tra chất lượng ấn phẩm, tài liệu demo và xác nhận nghiệm thu giai đoạn."
        badge="Nghiệm thu"
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<UserCheck className="w-10 h-10 text-[#13DEB9]" />}
          title="Không có sản phẩm nào đang chờ duyệt"
          description="Khi agency gửi bản thiết kế hoặc sản phẩm bàn giao, thông báo sẽ hiển thị tại đây."
        />
      </Card>
    </div>
  );
}
