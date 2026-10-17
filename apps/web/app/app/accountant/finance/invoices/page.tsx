"use client";

import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import InvoicesWorkspace from "@/components/finance/InvoicesWorkspace";

export default function AccountantInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#3453D1] animate-spin" />
          <span className="text-xs text-[#5B6B82]">
            Đang tải danh sách hóa đơn...
          </span>
        </div>
      }
    >
      <InvoicesWorkspace roleBasePath="/app/accountant" />
    </Suspense>
  );
}
