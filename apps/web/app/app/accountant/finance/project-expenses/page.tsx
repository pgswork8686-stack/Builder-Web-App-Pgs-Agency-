"use client";

import React, { useEffect, useState } from "react";
import {
  FolderKanban,
  Plus,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchExpenses,
  createExpense,
  reviewExpense,
  reimburseExpense,
  ProjectExpense,
} from "@/lib/api/expenses";
import { projectsApi, Project } from "@/lib/api/projects";

const CATEGORY_MAP: Record<string, string> = {
  travel: "Công tác & Di chuyển",
  software_license: "Bản quyền phần mềm",
  equipment: "Thiết bị & Công cụ",
  outsourcing: "Thuê ngoài (Outsourcing)",
  meal_entertainment: "Tiếp khách & Ăn uống",
  general: "Chi phí chung",
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: "warning" | "success" | "danger" | "blue" }
> = {
  pending: { label: "Chờ duyệt", variant: "warning" },
  approved: { label: "Đã duyệt", variant: "success" },
  rejected: { label: "Từ chối", variant: "danger" },
  reimbursed: { label: "Đã hoàn ứng", variant: "blue" },
};

export default function AccountantProjectExpensesPage() {
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal review
  const [reviewingExpense, setReviewingExpense] =
    useState<ProjectExpense | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [expRes, projRes] = await Promise.all([
        fetchExpenses({
          status: selectedStatus || undefined,
          category: selectedCategory || undefined,
          projectId: selectedProject || undefined,
        }),
        projectsApi.getAdminProjects({}).catch(() => ({ items: [] })),
      ]);
      setExpenses(expRes.items);
      setProjects(projRes.items || []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách chi phí.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedCategory, selectedProject]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount || !newProjectId) return;

    try {
      setSubmitting(true);
      await createExpense({
        projectId: newProjectId,
        title: newTitle.trim(),
        amount: Number(newAmount),
        expenseCategory: newCategory,
        notes: newNotes.trim() || null,
      });
      setShowCreateModal(false);
      setNewTitle("");
      setNewAmount("");
      setNewNotes("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể tạo đề nghị chi phí.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (action: "approved" | "rejected") => {
    if (!reviewingExpense) return;
    try {
      setActionLoading(true);
      await reviewExpense(reviewingExpense.id, {
        action,
        rejectionReason: action === "rejected" ? rejectionReason : null,
      });
      setReviewingExpense(null);
      setRejectionReason("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể cập nhật trạng thái chi phí.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReimburse = async (id: string) => {
    if (!confirm("Xác nhận giải ngân / hoàn ứng chi phí này?")) return;
    try {
      await reimburseExpense(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể giải ngân.");
    }
  };

  const totalApproved = expenses
    .filter((e) => e.status === "approved" || e.status === "reimbursed")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPending = expenses
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đề nghị & Chi phí Dự án (Project Expenses)"
        description="Kiểm soát chi phí phát sinh, mua tài nguyên và các đề nghị hoàn ứng theo từng dự án."
        badge="Chi phí dự án"
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreateModal(true)}
          >
            Tạo đề nghị chi phí
          </Button>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-[#1E293B] border-l-4 border-l-[#5D87FF]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#7C879D]">Tổng đã duyệt</p>
              <p className="text-xl font-bold text-[#2A3547] dark:text-white mt-1">
                {new Intl.NumberFormat("vi-VN").format(totalApproved)} đ
              </p>
            </div>
            <div className="p-3 bg-[#ECF2FF] rounded-lg text-[#5D87FF]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#1E293B] border-l-4 border-l-[#FFAE1F]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#7C879D]">Chờ duyệt</p>
              <p className="text-xl font-bold text-[#FFAE1F] mt-1">
                {new Intl.NumberFormat("vi-VN").format(totalPending)} đ
              </p>
            </div>
            <div className="p-3 bg-[#FEF5E5] rounded-lg text-[#FFAE1F]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#1E293B] border-l-4 border-l-[#13DEB9]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#7C879D]">Tổng số khoản chi</p>
              <p className="text-xl font-bold text-[#13DEB9] mt-1">
                {expenses.length}
              </p>
            </div>
            <div className="p-3 bg-[#E8F7FF] rounded-lg text-[#13DEB9]">
              <FolderKanban className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-[#1E293B] rounded-xl border border-[#EAEFF4] dark:border-[#334155]">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
        >
          <option value="">Tất cả dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.projectCode || "DA"})
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
        >
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORY_MAP).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
          <option value="reimbursed">Đã hoàn ứng</option>
        </select>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={loadData}
        >
          Làm mới
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden border border-[#EAEFF4] dark:border-[#334155]">
        {loading ? (
          <div className="p-12 text-center text-[#7C879D]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Đang tải danh sách chi phí...
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={<FolderKanban className="w-10 h-10 text-[#7C879D]" />}
              title="Chưa có đề nghị chi phí nào"
              description="Các khoản đề nghị chi phí dự án sẽ hiển thị tại đây."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F9FC] dark:bg-[#0F172A] border-b border-[#EAEFF4] dark:border-[#334155] text-xs font-semibold text-[#7C879D] uppercase">
                <tr>
                  <th className="px-4 py-3">Mã chi phí</th>
                  <th className="px-4 py-3">Tiêu đề khoản chi</th>
                  <th className="px-4 py-3">Dự án</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Người đề nghị</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEFF4] dark:divide-[#334155]">
                {expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-[#5D87FF]">
                      {exp.expense_code || "CP"}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#2A3547] dark:text-white">
                      {exp.title}
                    </td>
                    <td className="px-4 py-3 text-[#7C879D]">
                      {exp.project?.name || exp.project_code || "Dự án"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {CATEGORY_MAP[exp.expense_category] ||
                        exp.expense_category}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#2A3547] dark:text-white">
                      {new Intl.NumberFormat("vi-VN").format(
                        Number(exp.amount),
                      )}{" "}
                      {exp.currency_code}
                    </td>
                    <td className="px-4 py-3 text-[#7C879D]">
                      {exp.submitted_by?.full_name || "Nhân viên"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={STATUS_MAP[exp.status]?.variant || "warning"}
                        size="sm"
                      >
                        {STATUS_MAP[exp.status]?.label || exp.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {exp.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewingExpense(exp)}
                        >
                          Duyệt / Từ chối
                        </Button>
                      )}
                      {exp.status === "approved" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReimburse(exp.id)}
                        >
                          Giải ngân
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155]">
            <h3 className="text-lg font-bold text-[#2A3547] dark:text-white mb-4">
              Tạo đề nghị chi phí dự án
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Dự án áp dụng *
                </label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                >
                  <option value="">-- Chọn dự án --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectCode || "DA"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Tiêu đề khoản chi *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Mua tên miền & hosting khách hàng"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                    Số tiền (VNĐ) *
                  </label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="500000"
                    required
                    min="1000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                    Danh mục *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                  >
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                  Ghi chú chi tiết
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="Diễn giải thêm về hóa đơn, chứng từ..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? "Đang gửi..." : "Gửi đề nghị"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAEFF4] dark:border-[#334155]">
            <h3 className="text-lg font-bold text-[#2A3547] dark:text-white mb-2">
              Xét duyệt chi phí ({reviewingExpense.expense_code || "CP"})
            </h3>
            <p className="text-sm text-[#7C879D] mb-4">
              {reviewingExpense.title} —{" "}
              <strong className="text-[#2A3547] dark:text-white">
                {new Intl.NumberFormat("vi-VN").format(
                  Number(reviewingExpense.amount),
                )}{" "}
                đ
              </strong>
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#7C879D] mb-1">
                Lý do từ chối (nếu không duyệt)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Nhập lý do từ chối..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#EAEFF4] dark:border-[#334155] bg-transparent text-[#2A3547] dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewingExpense(null)}
              >
                Đóng
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleReview("rejected")}
              >
                Từ chối
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleReview("approved")}
              >
                Phê duyệt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
