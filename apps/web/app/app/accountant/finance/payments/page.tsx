"use client";

import React from "react";
import Link from "next/link";
import { DollarSign, Search, Filter } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantPaymentsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Thanh toán (Payments Tracking)"
        description="Theo dõi toàn bộ lịch sử giao dịch thanh toán từ các hóa đơn dịch vụ."
        badge="Thanh toán"
        action={
          <Link href="/app/accountant/finance/invoices">
            <Button variant="secondary" size="sm">
              Xem danh sách hóa đơn
            </Button>
          </Link>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<DollarSign className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có giao dịch thanh toán nào"
          description="Các khoản thanh toán được ghi nhận sẽ hiển thị chi tiết tại đây."
        />
      </Card>
    </div>
  );
}
