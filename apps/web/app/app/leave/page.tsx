"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Plane,
} from "lucide-react";
import {
  leaveApi,
  LeaveRequest,
  LeaveBalance,
  LeaveType,
} from "@/lib/api/leave";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";

export default function EmployeeLeavePage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // New leave request states
  const [selectedType, setSelectedType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const pageSize = 10;

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const typesRes = await leaveApi.getLeaveTypes();
      setLeaveTypes(typesRes);

      const balancesRes = await leaveApi.getMyBalances();
      setBalances(balancesRes);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể tải cấu hình nghỉ phép.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async (pageNum: number) => {
    try {
      const res = await leaveApi.getMyRequests({ page: pageNum, pageSize });
      setRequests(res.items);
      setTotalRequests(res.total);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadRequests(page);
  }, [page]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !startDate || !endDate) {
      setFeedback({
        type: "error",
        message: "Vui lòng chọn loại nghỉ phép và khoảng thời gian.",
      });
      return;
    }

    try {
      setSubmitLoading(true);
      setFeedback(null);

      await leaveApi.createRequest({
        leaveTypeId: selectedType,
        startDate,
        endDate,
        reason: reason || null,
      });

      setFeedback({
        type: "success",
        message: "Đơn xin nghỉ phép đã được gửi duyệt thành công.",
      });
      setCreateDialogOpen(false);
      setSelectedType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      loadMetadata();
      loadRequests(page);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gửi đơn xin nghỉ phép thất bại.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRequests / pageSize);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Quản lý Nghỉ phép (Leave Management)"
        description="Tra cứu quỹ phép năm, tạo đơn xin nghỉ và theo dõi tiến độ phê duyệt."
        badge={`${totalRequests} Đơn đã gửi`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Tạo đơn nghỉ phép
          </Button>
        }
      />

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 animate-in fade-in duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b) => (
          <StatCard
            key={b.id}
            variant="blue"
            title={b.leave_type?.name || "Nghỉ phép"}
            value={`${b.allocated_days - b.used_days} ngày`}
            subtitle={`Đã dùng: ${b.used_days} / Định mức: ${b.allocated_days} ngày`}
            icon={<Plane className="w-5 h-5" />}
          />
        ))}
        {balances.length === 0 && !loading && (
          <StatCard
            variant="blue"
            title="Quỹ phép thường niên"
            value="12 ngày"
            subtitle="Định mức năm 2026"
            icon={<Calendar className="w-5 h-5" />}
          />
        )}
      </div>

      {/* Requests History */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#0F172A]">
          Lịch sử đơn nghỉ phép ({totalRequests})
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Plane className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có đơn xin nghỉ phép nào"
            description="Bạn chưa gửi đơn xin nghỉ phép nào trong năm nay."
            actionLabel="Tạo đơn đầu tiên"
            onAction={() => setCreateDialogOpen(true)}
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Loại phép</TableHeaderCell>
                  <TableHeaderCell>Thời gian</TableHeaderCell>
                  <TableHeaderCell>Số ngày</TableHeaderCell>
                  <TableHeaderCell>Lý do</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Ngày gửi</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-[#0F172A]">
                      {r.leave_type?.name || "Nghỉ phép"}
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B]">
                      {r.start_date} ➔ {r.end_date}
                    </TableCell>

                    <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                      {r.total_days} ngày
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B] max-w-xs truncate">
                      {r.reason || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "success"
                            : r.status === "rejected"
                              ? "danger"
                              : "gold"
                        }
                        size="sm"
                      >
                        {r.status ? r.status.toUpperCase() : "—"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B]">
                      {new Date(r.created_at).toLocaleDateString("vi-VN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0] text-xs text-[#64748B]">
            <span>
              Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Leave Request Dialog */}
      <Dialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        title="Tạo đơn xin nghỉ phép"
        description="Gửi đơn đề xuất nghỉ phép tới quản lý trực tiếp xét duyệt."
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 pt-2">
          <Select
            label="Loại nghỉ phép *"
            required
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">-- Chọn loại nghỉ phép --</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Từ ngày *"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Đến ngày *"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Lý do xin nghỉ *
            </label>
            <textarea
              rows={3}
              placeholder="VD: Nghỉ phép thường niên cùng gia đình, giải quyết việc cá nhân..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitLoading}
              rightIcon={<Send className="w-4 h-4" />}
            >
              Gửi đơn xét duyệt
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
