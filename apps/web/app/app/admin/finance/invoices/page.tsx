"use client";

import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import InvoicesWorkspace from "@/components/finance/InvoicesWorkspace";

export default function AdminInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#4F75FF] animate-spin" />
          <span className="text-xs text-[#64748B]">
            Đang tải danh sách hóa đơn...
          </span>
        </div>
      }
    >
      <InvoicesWorkspace roleBasePath="/app/admin" />
    </Suspense>
  );
}
