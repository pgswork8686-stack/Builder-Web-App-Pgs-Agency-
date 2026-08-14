"use client";

import React from "react";
import { CreditCard, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AccountantCashflowPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản lý Thu Chi & Dòng tiền (Cashflow Management)"
        description="Theo dõi biến động dòng tiền thực tế, nguồn thu từ dịch vụ và các khoản chi hoạt động."
        badge="Dòng tiền"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7C879D]">
              Tổng thu tháng 8/2026
            </span>
            <TrendingUp className="w-4 h-4 text-[#13DEB9]" />
          </div>
          <p className="text-2xl font-black text-[#24304A]">0 ₫</p>
        </Card>

        <Card className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7C879D]">
              Tổng chi tháng 8/2026
            </span>
            <TrendingDown className="w-4 h-4 text-[#FA896B]" />
          </div>
          <p className="text-2xl font-black text-[#24304A]">0 ₫</p>
        </Card>
      </div>

      <Card className="p-10 text-center">
        <EmptyState
          icon={<CreditCard className="w-10 h-10 text-[#7C879D]" />}
          title="Chưa có dữ liệu biến động thu chi"
          description="Dữ liệu dòng tiền sẽ được cập nhật tự động khi phát sinh các giao dịch thu hoặc chi."
        />
      </Card>
    </div>
  );
}
