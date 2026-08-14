"use client";

import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import InvoicesWorkspace from "@/components/finance/InvoicesWorkspace";

export default function AdminInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin" />
          <span className="text-sm text-[#606060]">Đang tải hóa đơn...</span>
        </div>
      }
    >
      <InvoicesWorkspace roleBasePath="/app/admin" />
    </Suspense>
  );
}
