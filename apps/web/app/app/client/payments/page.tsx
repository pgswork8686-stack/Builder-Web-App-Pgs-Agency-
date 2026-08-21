"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, Receipt, ChevronLeft } from "lucide-react";
import { financeApi } from "@/lib/api/finance";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientPaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await financeApi.getInvoices();
        setInvoices(res?.items || []);
      } catch {
        // Safe load
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lịch sử Thanh toán & Hóa đơn"
        description="Tra cứu tiến độ giải ngân, lịch sử thanh toán các đợt theo hợp đồng dịch vụ."
        badge="Thanh toán"
        action={
          <Link href="/app/client/invoices">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Receipt className="w-4 h-4" />}
            >
              Danh sách hóa đơn
            </Button>
          </Link>
        }
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<DollarSign className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có giao dịch thanh toán nào"
          description="Lịch sử đối soát và biên lai thanh toán thành công sẽ được hiển thị tại đây."
        />
      </Card>
    </div>
  );
}
