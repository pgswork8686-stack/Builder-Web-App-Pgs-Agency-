"use client";

import React from "react";
import FinanceDashboard from "@/components/finance/FinanceDashboard";

export default function AdminFinanceDashboardPage() {
  return <FinanceDashboard roleBasePath="/app/admin" />;
}
