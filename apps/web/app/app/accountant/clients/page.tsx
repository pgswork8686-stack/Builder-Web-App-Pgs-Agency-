"use client";

import React from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The company directory API (`GET /admin/clients`) is Admin-only and the
 * accountant role has no read endpoint for it. The previous page swallowed the
 * resulting 403 and told the accountant "no customers exist", which is false.
 *
 * Opening a read-only directory to accountants is a permission decision for the
 * product owner (see docs/release/FINAL_GAP_AUDIT.md, finding F-05). Until then
 * this page says so and points to the screens that already carry customer
 * names with real finance data.
 */
export default function AccountantClientsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Khách hàng & Công nợ"
        description="Công nợ, hóa đơn và hợp đồng theo từng khách hàng."
      />

      <Card className="p-10 text-center">
        <EmptyState
          icon={<Briefcase className="w-10 h-10 text-[#5F6E85]" />}
          title="Danh bạ khách hàng chưa được mở cho Kế toán"
          description="Tài khoản Kế toán chưa được cấp quyền xem danh bạ doanh nghiệp. Bạn vẫn xem được tên khách hàng kèm số liệu tài chính ở các màn bên dưới."
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/app/accountant/finance/debts">
            <Button variant="primary" size="sm">
              Công nợ theo khách hàng
            </Button>
          </Link>
          <Link href="/app/accountant/finance/invoices">
            <Button variant="secondary" size="sm">
              Hóa đơn
            </Button>
          </Link>
          <Link href="/app/accountant/finance/contracts">
            <Button variant="secondary" size="sm">
              Hợp đồng
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
