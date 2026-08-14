"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantDebtsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Công nợ (Accounts Receivable)"
        description="Kiểm soát công nợ khách hàng, thời hạn thanh toán và các khoản nợ quá hạn."
        badge="Công nợ"
        action={
          <Link href="/app/accountant/finance/invoices">
            <Button variant="secondary" size="sm">
              Xem hóa đơn chưa thanh toán
            </Button>
          </Link>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<TrendingUp className="w-10 h-10 text-[#7C879D]" />}
          title="Không có khoản nợ quá hạn nào"
          description="Toàn bộ công nợ khách hàng đang trong trạng thái cân đối."
        />
      </Card>
    </div>
  );
}
