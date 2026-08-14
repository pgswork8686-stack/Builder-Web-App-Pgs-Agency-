"use client";

import React from "react";
import Link from "next/link";
import { UserCheck, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function TeamLeaderApprovalsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đơn Cần Duyệt (Pending Approvals)"
        description="Xét duyệt các đơn xin nghỉ phép, giải trình công và sản phẩm bàn giao từ thành viên trong nhóm."
        badge="Phê duyệt"
        action={
          <Link href="/app/leave">
            <Button variant="secondary" size="sm">
              Xem lịch sử duyệt
            </Button>
          </Link>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<UserCheck className="w-10 h-10 text-[#13DEB9]" />}
          title="Không có đơn nào đang chờ duyệt"
          description="Tất cả các yêu cầu từ thành viên trong nhóm đã được xử lý xong."
        />
      </Card>
    </div>
  );
}
