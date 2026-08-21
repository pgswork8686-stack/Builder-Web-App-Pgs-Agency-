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
  Settings,
  History,
  AlertTriangle,
  Award,
  Clock,
  UserCheck,
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
  fetchEmployeeCompensations,
  fetchCompensationHistory,
  createCompensationRevision,
  fetchMonthlyReviews,
  upsertMonthlyReview,
  PayrollRun,
  EmployeeCompensationItem,
  CompensationHistoryItem,
  MonthlyPayrollReview,
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

  const [activeTab, setActiveTab] = useState<
    "runs" | "compensations" | "reviews"
  >("runs");
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [compensations, setCompensations] = useState<
    EmployeeCompensationItem[]
  >([]);
  const [reviews, setReviews] = useState<MonthlyPayrollReview[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Compensation Revision Modal
  const [revisionModalUser, setRevisionModalUser] =
    useState<EmployeeCompensationItem | null>(null);
  const [revBaseSalary, setRevBaseSalary] = useState<string>("");
  const [revAllowances, setRevAllowances] = useState<string>("0");
  const [revEffectiveFrom, setRevEffectiveFrom] = useState<string>(
    `${currentMonth}-01`,
  );
  const [revPayrollEligible, setRevPayrollEligible] = useState<boolean>(true);
  const [revNotes, setRevNotes] = useState<string>("");
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Compensation History Modal
  const [historyUser, setHistoryUser] =
    useState<EmployeeCompensationItem | null>(null);
  const [historyList, setHistoryList] = useState<CompensationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === "runs") {
        const res = await fetchPayrollRuns();
        setRuns(res.items);
      } else if (activeTab === "compensations") {
        const res = await fetchEmployeeCompensations();
        setCompensations(res.items);
      } else if (activeTab === "reviews") {
        const [compRes, revRes] = await Promise.all([
          fetchEmployeeCompensations(),
          fetchMonthlyReviews(selectedMonth),
        ]);
        setCompensations(compRes.items);
        setReviews(revRes.items);
      }
    } catch (err) {
      console.error("Failed to load payroll data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedMonth]);

  const handleGenerate = async () => {
    try {
      setCalculating(true);
      // Pre-check active employees compensation
      const compRes = await fetchEmployeeCompensations();
      const missing = compRes.items.filter((c) => c.status === "missing");
      if (missing.length > 0) {
        alert(
          `Cảnh báo: Có ${missing.length} nhân sự chưa được cấu hình lương. Vui lòng cập nhật cấu hình lương ở tab "Cấu hình & Lịch sử lương" trước khi tính toán.`,
        );
        setActiveTab("compensations");
        return;
      }

      await generatePayrollRun({
        periodMonth: selectedMonth,
        title: `Bảng lương Tháng ${selectedMonth.split("-")[1]}/${selectedMonth.split("-")[0]}`,
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

  const openRevisionModal = (emp: EmployeeCompensationItem) => {
    setRevisionModalUser(emp);
    setRevBaseSalary(emp.baseSalary ? String(emp.baseSalary) : "");
    setRevAllowances(emp.allowances ? String(emp.allowances) : "0");
    setRevEffectiveFrom(`${selectedMonth}-01`);
    setRevPayrollEligible(emp.payrollEligible);
    setRevNotes(emp.notes || "");
  };

  const handleSaveRevision = async () => {
    if (!revisionModalUser) return;
    const base = Number(revBaseSalary);
    const allow = Number(revAllowances);
    if (!base || base <= 0) {
      alert("Lương cơ bản phải là số dương lớn hơn 0.");
      return;
    }
    if (isNaN(allow) || allow < 0) {
      alert("Phụ cấp không được là số âm.");
      return;
    }
    if (!/^\d{4}-\d{2}-01$/.test(revEffectiveFrom)) {
      alert("Ngày hiệu lực phải là ngày đầu tiên của tháng (YYYY-MM-01).");
      return;
    }

    try {
      setSubmittingRevision(true);
      await createCompensationRevision(revisionModalUser.userId, {
        baseSalary: base,
        allowances: allow,
        effectiveFrom: revEffectiveFrom,
        payrollEligible: revPayrollEligible,
        notes: revNotes,
      });
      setRevisionModalUser(null);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể lưu cấu hình lương.");
    } finally {
      setSubmittingRevision(false);
    }
  };

  const openHistoryModal = async (emp: EmployeeCompensationItem) => {
    setHistoryUser(emp);
    try {
      setLoadingHistory(true);
      const res = await fetchCompensationHistory(emp.userId);
      setHistoryList(res.history);
    } catch (err: any) {
      alert(err?.message || "Không thể tải lịch sử lương.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleReview = async (
    userId: string,
    currentDiscipline: boolean,
    currentEarlyLeave: boolean,
  ) => {
    try {
      await upsertMonthlyReview(userId, selectedMonth, {
        disciplineBonusEligible: !currentDiscipline,
        earlyLeaveMakeupConfirmed: currentEarlyLeave,
      });
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật đánh giá.");
    }
  };

  const handleToggleEarlyLeaveConfirmation = async (
    userId: string,
    currentDiscipline: boolean,
    currentEarlyLeave: boolean,
  ) => {
    try {
      await upsertMonthlyReview(userId, selectedMonth, {
        disciplineBonusEligible: currentDiscipline,
        earlyLeaveMakeupConfirmed: !currentEarlyLeave,
      });
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật xác nhận làm bù.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Quản Lý Lương & Chấm Công PGS (Enterprise Payroll)"
        description="Tính toán lương tự động dựa trên lịch làm việc PGS, tuân thủ chấm công, phạt muộn và thưởng chuyên cần 250.000 đ."
        badge={currentMonthStr}
        action={
          <div className="flex items-center gap-2">
            {activeTab === "runs" && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                disabled={calculating}
                onClick={handleGenerate}
              >
                {calculating ? "Đang tính toán..." : "Tính toán tự động"}
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#EAEFF4] dark:border-[#334155] gap-4">
        <button
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "runs"
              ? "border-[#5D87FF] text-[#5D87FF]"
              : "border-transparent text-[#7C879D] hover:text-[#2A3547] dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("runs")}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Đợt lương (Payroll Runs)
        </button>
        <button
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "compensations"
              ? "border-[#5D87FF] text-[#5D87FF]"
              : "border-transparent text-[#7C879D] hover:text-[#2A3547] dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("compensations")}
        >
          <Settings className="w-4 h-4" />
          Cấu hình & Lịch sử lương nhân sự
        </button>
        <button
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "reviews"
              ? "border-[#5D87FF] text-[#5D87FF]"
              : "border-transparent text-[#7C879D] hover:text-[#2A3547] dark:hover:text-white"
          }`}
          onClick={() => setActiveTab("reviews")}
        >
          <Award className="w-4 h-4" />
          Đánh giá kỷ luật & Thưởng chuyên cần
        </button>
      </div>

      {/* TAB 1: RUNS */}
      {activeTab === "runs" && (
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
                title="Chưa có đợt lương nào"
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
                    <th className="px-4 py-3 text-right">
                      Tổng lương thực chi
                    </th>
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
      )}

      {/* TAB 2: COMPENSATION CONFIGURATION & HISTORY */}
      {activeTab === "compensations" && (
        <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
          <div className="p-4 border-b border-[#EAEFF4] dark:border-[#334155] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#2A3547] dark:text-white">
                Cấu hình & Lịch sử mức lương nhân sự
              </h3>
              <p className="text-xs text-[#7C879D] mt-0.5">
                Mỗi lần điều chỉnh mức lương sẽ tạo một phiên bản lịch sử mới có
                ngày hiệu lực. Không có mức lương mặc định.
              </p>
            </div>
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
              Đang tải danh sách nhân sự...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                  <tr>
                    <th className="px-4 py-3">Mã NV</th>
                    <th className="px-4 py-3">Họ tên & Vị trí</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Lương cơ bản</th>
                    <th className="px-4 py-3 text-right">Phụ cấp</th>
                    <th className="px-4 py-3">Ngày hiệu lực</th>
                    <th className="px-4 py-3 text-center">Lịch sử</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                  {compensations.map((emp) => (
                    <tr
                      key={emp.userId}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                        {emp.employeeCode || emp.accountCode || "NV"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#2A3547] dark:text-white">
                          {emp.fullName || "Nhân sự"}
                        </div>
                        <div className="text-xs text-[#7C879D]">
                          {emp.jobTitle || emp.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {emp.status === "configured" ? (
                          <Badge variant="success" size="sm">
                            Đã cấu hình
                          </Badge>
                        ) : emp.status === "not_eligible" ? (
                          <Badge variant="warning" size="sm">
                            Miễn tính lương
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm">
                            Chưa cấu hình
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#2A3547] dark:text-white">
                        {emp.baseSalary
                          ? `${new Intl.NumberFormat("vi-VN").format(emp.baseSalary)} đ`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[#7C879D]">
                        {emp.allowances !== null
                          ? `${new Intl.NumberFormat("vi-VN").format(emp.allowances)} đ`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#7C879D]">
                        {emp.effectiveFrom || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="inline-flex items-center gap-1 text-xs text-[#5D87FF] hover:underline"
                          onClick={() => openHistoryModal(emp)}
                        >
                          <History className="w-3.5 h-3.5" />
                          {emp.historyCount} bản ghi
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRevisionModal(emp)}
                        >
                          Điều chỉnh lương
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: REVIEWS */}
      {activeTab === "reviews" && (
        <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
          <div className="p-4 border-b border-[#EAEFF4] dark:border-[#334155] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#2A3547] dark:text-white">
                Đánh giá kỷ luật & Thưởng chuyên cần tháng {selectedMonth}
              </h3>
              <p className="text-xs text-[#7C879D] mt-0.5">
                Nhân sự chỉ nhận 250.000 đ thưởng chuyên cần khi: đi muộn ≤ 3
                lần, không nghỉ làm ngày công chuẩn, không về sớm chưa duyệt và
                đạt tiêu chuẩn kỷ luật.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                className="px-3 py-1.5 border border-[#EAEFF4] dark:border-[#334155] rounded-lg text-sm bg-transparent"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={loadData}
              >
                Làm mới
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                <tr>
                  <th className="px-4 py-3">Mã NV</th>
                  <th className="px-4 py-3">Nhân sự</th>
                  <th className="px-4 py-3 text-center">
                    Đạt tiêu chuẩn kỷ luật
                  </th>
                  <th className="px-4 py-3 text-center">
                    Xác nhận làm bù về sớm
                  </th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                {compensations.map((emp) => {
                  const rev = reviews.find((r) => r.user_id === emp.userId);
                  const isDisciplineEligible = rev
                    ? rev.discipline_bonus_eligible
                    : true;
                  const isEarlyLeaveConfirmed = rev
                    ? rev.early_leave_makeup_confirmed
                    : false;

                  return (
                    <tr
                      key={emp.userId}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                        {emp.employeeCode || emp.accountCode || "NV"}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2A3547] dark:text-white">
                        {emp.fullName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={isDisciplineEligible ? "success" : "danger"}
                          size="sm"
                        >
                          {isDisciplineEligible
                            ? "Đạt tiêu chuẩn"
                            : "Không đạt kỷ luật"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            isEarlyLeaveConfirmed ? "success" : "warning"
                          }
                          size="sm"
                        >
                          {isEarlyLeaveConfirmed
                            ? "Đã xác nhận bù"
                            : "Chưa làm bù"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleReview(
                                emp.userId,
                                isDisciplineEligible,
                                isEarlyLeaveConfirmed,
                              )
                            }
                          >
                            {isDisciplineEligible
                              ? "Hủy thưởng kỷ luật"
                              : "Kích hoạt kỷ luật"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleEarlyLeaveConfirmation(
                                emp.userId,
                                isDisciplineEligible,
                                isEarlyLeaveConfirmed,
                              )
                            }
                          >
                            {isEarlyLeaveConfirmed
                              ? "Hủy xác nhận làm bù"
                              : "Xác nhận làm bù"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DETAIL MODAL WITH FULL BREAKDOWN */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-5xl w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155] max-h-[90vh] flex flex-col">
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
                    <th className="px-3 py-2 text-center">
                      Công chuẩn / Đi làm
                    </th>
                    <th className="px-3 py-2 text-right">Lương cơ bản</th>
                    <th className="px-3 py-2 text-right">Phụ cấp</th>
                    <th className="px-3 py-2 text-center">Muộn (lần / phút)</th>
                    <th className="px-3 py-2 text-right">Phạt muộn</th>
                    <th className="px-3 py-2 text-right">Thưởng CC (250k)</th>
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
                      <td className="px-3 py-2.5 text-center text-[#7C879D]">
                        {ps.late_occurrences || 0} lần ({ps.late_minutes || 0}{" "}
                        p)
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#FA896B]">
                        {ps.attendance_penalty_amount
                          ? `-${new Intl.NumberFormat("vi-VN").format(Number(ps.attendance_penalty_amount))} đ`
                          : "0 đ"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#13DEB9]">
                        {ps.attendance_bonus_amount
                          ? `+${new Intl.NumberFormat("vi-VN").format(Number(ps.attendance_bonus_amount))} đ`
                          : "0 đ"}
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

      {/* REVISION MODAL */}
      {revisionModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155] space-y-4">
            <h3 className="text-base font-bold text-[#2A3547] dark:text-white">
              Cập nhật mức lương: {revisionModalUser.fullName}
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Lương cơ bản (VND) *
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-[#EAEFF4] dark:border-[#334155] rounded-lg bg-transparent text-[#2A3547] dark:text-white"
                  placeholder="Ví dụ: 15000000"
                  value={revBaseSalary}
                  onChange={(e) => setRevBaseSalary(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Phụ cấp (VND)
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-[#EAEFF4] dark:border-[#334155] rounded-lg bg-transparent text-[#2A3547] dark:text-white"
                  placeholder="Ví dụ: 1000000"
                  value={revAllowances}
                  onChange={(e) => setRevAllowances(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Ngày hiệu lực (YYYY-MM-01) *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-[#EAEFF4] dark:border-[#334155] rounded-lg bg-transparent text-[#2A3547] dark:text-white"
                  value={revEffectiveFrom}
                  onChange={(e) => setRevEffectiveFrom(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="payrollEligibleCheck"
                  checked={revPayrollEligible}
                  onChange={(e) => setRevPayrollEligible(e.target.checked)}
                />
                <label
                  htmlFor="payrollEligibleCheck"
                  className="text-xs font-medium"
                >
                  Áp dụng tính bảng lương (Payroll Eligible)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Ghi chú điều chỉnh
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-[#EAEFF4] dark:border-[#334155] rounded-lg bg-transparent text-[#2A3547] dark:text-white text-xs"
                  rows={2}
                  placeholder="Lý do điều chỉnh lương..."
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAEFF4] dark:border-[#334155]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevisionModalUser(null)}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submittingRevision}
                onClick={handleSaveRevision}
              >
                {submittingRevision ? "Đang lưu..." : "Lưu phiên bản lương"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155] space-y-4">
            <h3 className="text-base font-bold text-[#2A3547] dark:text-white">
              Lịch sử điều chỉnh lương: {historyUser.fullName}
            </h3>

            {loadingHistory ? (
              <div className="p-8 text-center text-[#7C879D]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Đang tải lịch sử...
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#7C879D]">
                Chưa có phiên bản lương nào được lưu.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] font-semibold text-[#7C879D] uppercase">
                    <tr>
                      <th className="px-3 py-2">Hiệu lực từ</th>
                      <th className="px-3 py-2 text-right">Lương cơ bản</th>
                      <th className="px-3 py-2 text-right">Phụ cấp</th>
                      <th className="px-3 py-2 text-center">Trạng thái</th>
                      <th className="px-3 py-2">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                    {historyList.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-mono font-medium text-[#5D87FF]">
                          {h.effectiveFrom}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[#2A3547] dark:text-white">
                          {new Intl.NumberFormat("vi-VN").format(
                            Number(h.baseSalary),
                          )}{" "}
                          đ
                        </td>
                        <td className="px-3 py-2 text-right text-[#7C879D]">
                          {new Intl.NumberFormat("vi-VN").format(
                            Number(h.allowances),
                          )}{" "}
                          đ
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant={h.payrollEligible ? "success" : "warning"}
                            size="sm"
                          >
                            {h.payrollEligible ? "Tính lương" : "Miễn tính"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#7C879D]">
                          {h.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#EAEFF4] dark:border-[#334155]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryUser(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
