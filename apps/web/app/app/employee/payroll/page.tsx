"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  DollarSign,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchMyPayslips, Payslip } from "@/lib/api/payroll";

export default function EmployeePayrollPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchMyPayslips();
      setPayslips(data || []);
    } catch (err) {
      console.error("Failed to load my payslips", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Phiếu Lương Cá nhân (My Payslips)"
        description="Tra cứu chi tiết phiếu lương hàng tháng, các khoản khấu trừ và bảo hiểm."
        badge="Phiếu lương"
      />

      <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
        {loading ? (
          <div className="p-12 text-center text-[#7C879D]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Đang tải phiếu lương cá nhân...
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={<FileText className="w-10 h-10 text-[#7C879D]" />}
              title="Chưa có phiếu lương nào được phát hành"
              description="Phiếu lương tháng sẽ hiển thị sau khi bộ phận Kế toán chốt kỳ thanh toán lương."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                <tr>
                  <th className="px-4 py-3">Mã phiếu</th>
                  <th className="px-4 py-3">Kỳ lương</th>
                  <th className="px-4 py-3 text-center">Ngày công</th>
                  <th className="px-4 py-3 text-right">Lương cơ bản</th>
                  <th className="px-4 py-3 text-right">Phụ cấp & Thưởng</th>
                  <th className="px-4 py-3 text-right">Thực nhận</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                {payslips.map((ps) => (
                  <tr
                    key={ps.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                      {ps.payslip_code || "PL"}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#2A3547] dark:text-white">
                      {ps.payroll_run?.title ||
                        ps.payroll_run?.period_month ||
                        "Kỳ lương"}
                    </td>
                    <td className="px-4 py-3 text-center text-[#2A3547] dark:text-white font-medium">
                      {ps.actual_worked_days} / {ps.standard_working_days}
                    </td>
                    <td className="px-4 py-3 text-right text-[#7C879D]">
                      {new Intl.NumberFormat("vi-VN").format(
                        Number(ps.base_salary),
                      )}{" "}
                      đ
                    </td>
                    <td className="px-4 py-3 text-right text-[#7C879D]">
                      {new Intl.NumberFormat("vi-VN").format(
                        Number(ps.allowances) +
                          Number(ps.bonus) +
                          Number(ps.overtime_pay),
                      )}{" "}
                      đ
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#13DEB9]">
                      {new Intl.NumberFormat("vi-VN").format(
                        Number(ps.net_salary),
                      )}{" "}
                      đ
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          ps.payment_status === "paid" ? "success" : "warning"
                        }
                        size="sm"
                      >
                        {ps.payment_status === "paid"
                          ? "Đã chi trả"
                          : "Chờ chi trả"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
