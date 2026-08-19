"use client";

import React, { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Plus,
  DollarSign,
  CheckCircle2,
  Users,
  Calendar,
  RefreshCw,
  Eye,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchPayrollRuns,
  generatePayrollRun,
  approvePayrollRun,
  payPayrollRun,
  fetchPayrollRunById,
  PayrollRun,
} from "@/lib/api/payroll";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "warning" | "success" | "danger" | "blue" }
> = {
  draft: { label: "Bản nháp", variant: "warning" },
  calculated: { label: "Đã tính toán", variant: "blue" },
  approved: { label: "Đã phê duyệt", variant: "success" },
  paid: { label: "Đã chi trả", variant: "success" },
  locked: { label: "Đã khóa", variant: "danger" },
};

export default function AccountantPayrollPage() {
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentMonthStr = `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchPayrollRuns();
      setRuns(res.items);
    } catch (err) {
      console.error("Failed to load payroll runs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async () => {
    try {
      setCalculating(true);
      await generatePayrollRun({
        periodMonth: currentMonth,
        title: `Bảng lương ${currentMonthStr}`,
        standardWorkingDays: 22,
      });
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể tính toán bảng lương.");
    } finally {
      setCalculating(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const run = await fetchPayrollRunById(id);
      setSelectedRun(run);
    } catch (err: any) {
      alert(err?.message || "Không thể tải chi tiết bảng lương.");
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Xác nhận phê duyệt bảng lương này?")) return;
    try {
      setActionLoading(true);
      await approvePayrollRun(id);
      loadData();
      if (selectedRun?.id === id) {
        handleViewDetail(id);
      }
    } catch (err: any) {
      alert(err?.message || "Không thể duyệt bảng lương.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePay = async (id: string) => {
    if (!confirm("Xác nhận chi trả toàn bộ phiếu lương trong đợt này?")) return;
    try {
      setActionLoading(true);
      await payPayrollRun(id);
      loadData();
      if (selectedRun?.id === id) {
        handleViewDetail(id);
      }
    } catch (err: any) {
      alert(err?.message || "Không thể đánh dấu chi trả.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bảng Lương Doanh Nghiệp (Payroll Reconciliation)"
        description="Tính toán và chốt bảng thanh toán lương dựa trên dữ liệu công chuẩn và phụ cấp dự án."
        badge={currentMonthStr}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              disabled={calculating}
              onClick={handleGenerate}
            >
              {calculating ? "Đang tính toán..." : "Tính toán tự động"}
            </Button>
          </div>
        }
      />

      {/* Runs Table */}
      <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
        <div className="p-4 border-b border-[#EAEFF4] dark:border-[#334155] flex items-center justify-between">
          <h3 className="font-semibold text-[#2A3547] dark:text-white">
            Danh sách đợt chi trả lương
          </h3>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadData}
          >
            Làm mới
          </Button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#7C879D]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Đang tải dữ liệu bảng lương...
          </div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={<FileSpreadsheet className="w-10 h-10 text-[#7C879D]" />}
              title={`Chưa có đợt lương nào`}
              description="Nhấn 'Tính toán tự động' để hệ thống tổng hợp công chấm và lập bảng lương."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                <tr>
                  <th className="px-4 py-3">Mã đợt lương</th>
                  <th className="px-4 py-3">Kỳ lương</th>
                  <th className="px-4 py-3">Tiêu đề</th>
                  <th className="px-4 py-3 text-center">Số nhân sự</th>
                  <th className="px-4 py-3 text-right">Tổng lương thực chi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                      {r.run_code || "BL"}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#2A3547] dark:text-white">
                      {r.period_month}
                    </td>
                    <td className="px-4 py-3 text-[#7C879D]">{r.title}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#2A3547] dark:text-white">
                      {r.total_employees_count}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#13DEB9]">
                      {new Intl.NumberFormat("vi-VN").format(
                        Number(r.total_net_amount),
                      )}{" "}
                      đ
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_MAP[r.status]?.variant || "warning"}
                        size="sm"
                      >
                        {STATUS_MAP[r.status]?.label || r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => handleViewDetail(r.id)}
                      >
                        Chi tiết
                      </Button>
                      {r.status === "calculated" && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleApprove(r.id)}
                        >
                          Duyệt
                        </Button>
                      )}
                      {r.status === "approved" && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handlePay(r.id)}
                        >
                          Chi trả
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#EAEFF4] dark:border-[#334155]">
              <div>
                <h3 className="text-lg font-bold text-[#2A3547] dark:text-white">
                  Chi tiết đợt lương: {selectedRun.title} (
                  {selectedRun.run_code || "BL"})
                </h3>
                <p className="text-xs text-[#7C879D] mt-0.5">
                  Kỳ công: {selectedRun.period_start_date} đến{" "}
                  {selectedRun.period_end_date}
                </p>
              </div>
              <Badge
                variant={STATUS_MAP[selectedRun.status]?.variant || "warning"}
                size="md"
              >
                {STATUS_MAP[selectedRun.status]?.label || selectedRun.status}
              </Badge>
            </div>

            <div className="overflow-y-auto my-4 flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] font-semibold text-[#7C879D] uppercase">
                  <tr>
                    <th className="px-3 py-2">Mã phiếu</th>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2 text-center">Ngày công</th>
                    <th className="px-3 py-2 text-right">Lương cơ bản</th>
                    <th className="px-3 py-2 text-right">Phụ cấp</th>
                    <th className="px-3 py-2 text-right">Thực nhận</th>
                    <th className="px-3 py-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                  {selectedRun.payslips?.map((ps) => (
                    <tr
                      key={ps.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50"
                    >
                      <td className="px-3 py-2.5 font-mono text-[#5D87FF]">
                        {ps.payslip_code || "PL"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#2A3547] dark:text-white">
                        {ps.user?.full_name || "Nhân sự"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ps.actual_worked_days} / {ps.standard_working_days}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#7C879D]">
                        {new Intl.NumberFormat("vi-VN").format(
                          Number(ps.base_salary),
                        )}{" "}
                        đ
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#7C879D]">
                        {new Intl.NumberFormat("vi-VN").format(
                          Number(ps.allowances),
                        )}{" "}
                        đ
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#13DEB9]">
                        {new Intl.NumberFormat("vi-VN").format(
                          Number(ps.net_salary),
                        )}{" "}
                        đ
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant={
                            ps.payment_status === "paid" ? "success" : "warning"
                          }
                          size="sm"
                        >
                          {ps.payment_status === "paid" ? "Đã chi" : "Chờ chi"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[#EAEFF4] dark:border-[#334155]">
              <div className="text-sm font-semibold text-[#2A3547] dark:text-white">
                Tổng thực chi:{" "}
                <span className="text-[#13DEB9]">
                  {new Intl.NumberFormat("vi-VN").format(
                    Number(selectedRun.total_net_amount),
                  )}{" "}
                  đ
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRun(null)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
