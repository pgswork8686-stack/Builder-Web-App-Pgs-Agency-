"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  ListFilter,
  Plus,
} from "lucide-react";
import { leaveApi, type LeaveRequest } from "@/lib/api/leave";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Review states
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Calendar parameters
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await leaveApi.getDirectory({
        status: statusFilter || undefined,
        page,
        pageSize,
      });

      setRequests(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Lỗi lấy đơn nghỉ phép:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      setCalendarLoading(true);
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);

      const events = await leaveApi.getCalendar(startOfMonth, endOfMonth);
      setCalendarEvents(events);
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [page, statusFilter]);

  useEffect(() => {
    loadCalendar();
  }, []);

  const handleOpenReview = (req: LeaveRequest) => {
    setSelectedRequest(req);
    setReviewNote("");
    setActionFeedback(null);
  };

  const handleReviewSubmit = async (action: "approved" | "rejected") => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);
      setActionFeedback(null);

      await leaveApi.reviewRequest(selectedRequest.id, {
        action,
        reviewNote: reviewNote || null,
      });

      setSelectedRequest(null);
      await loadRequests();
      await loadCalendar();
    } catch (err: any) {
      setActionFeedback(err.message || "Không thể phê duyệt đơn phép.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header matching Figma */}
      <SectionHeader
        title="Đơn cần duyệt"
        description="Manager xử lý đơn của đội nhóm; Admin xử lý ngoại lệ."
        badge={`${total} Đơn`}
        action={
          <Link href="/app/admin">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Quay lại
            </Button>
          </Link>
        }
      />

      {/* 4 Pastel Metric Cards from Duyệt nghỉ phép.png */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          variant="gold"
          title="Chờ duyệt"
          value={total.toString().padStart(2, "0")}
          subtitle="Hôm nay"
        />
        <StatCard
          variant="green"
          title="Đã duyệt"
          value="18"
          subtitle="Tháng này"
        />
        <StatCard
          variant="rose"
          title="Từ chối"
          value="02"
          subtitle="Tháng này"
        />
        <StatCard
          variant="blue"
          title="Đang nghỉ"
          value="04"
          subtitle="Hiện tại"
        />
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-[#4F75FF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
            Lọc danh sách
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: "pending", label: "Chờ duyệt" },
            { id: "approved", label: "Đã duyệt" },
            { id: "rejected", label: "Từ chối" },
            { id: "cancelled", label: "Đã hủy" },
            { id: "", label: "Tất cả" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setStatusFilter(item.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === item.id
                  ? "bg-[#4F75FF] text-white shadow-xs"
                  : "bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Column Grid: Main Table & Calendar Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Đơn cần duyệt ({total})
              </h3>
              <span className="text-xs text-[#64748B]">
                Trang {page} / {totalPages || 1}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-8 h-8 text-[#4F75FF]" />}
                title="Không tìm thấy đơn nghỉ phép"
                description="Tất cả các đơn theo bộ lọc hiện tại đã được xử lý xong."
              />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Nhân sự</TableHeaderCell>
                      <TableHeaderCell>Loại nghỉ</TableHeaderCell>
                      <TableHeaderCell>Thời gian</TableHeaderCell>
                      <TableHeaderCell>Số ngày</TableHeaderCell>
                      <TableHeaderCell>Trạng thái</TableHeaderCell>
                      <TableHeaderCell className="text-right">
                        Thao tác
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-bold text-[#0F172A]">
                            {req.employee?.fullName || "Chưa cập nhật"}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {req.employee?.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-[#64748B]">
                          {req.leave_type?.name || "Phép năm"}
                        </TableCell>
                        <TableCell className="text-xs text-[#0F172A]">
                          {req.start_date} ➔ {req.end_date}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                          {Number(req.total_days).toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "approved"
                                ? "success"
                                : req.status === "rejected"
                                  ? "danger"
                                  : "gold"
                            }
                            size="sm"
                          >
                            {req.status === "pending"
                              ? "Chờ duyệt"
                              : req.status === "approved"
                                ? "Đã duyệt"
                                : req.status === "rejected"
                                  ? "Từ chối"
                                  : req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "pending" ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenReview(req)}
                            >
                              Xét duyệt
                            </Button>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">
                              Đã đóng
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
                <span>Tổng số {total} đơn</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Calendar Column */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
              <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4F75FF]" />
                Lịch nghỉ phép được duyệt
              </h3>
            </div>

            <div className="space-y-3">
              {calendarLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : calendarEvents.length === 0 ? (
                <p className="text-center py-6 text-xs text-[#64748B]">
                  Không có ai nghỉ phép trong tháng này.
                </p>
              ) : (
                calendarEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#EDF2F7] text-xs space-y-1"
                  >
                    <div className="font-bold text-[#0F172A]">
                      {evt.fullName}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {evt.leaveType}
                    </div>
                    <div className="text-[11px] text-[#4F75FF] font-semibold">
                      {evt.startDate} ➔ {evt.endDate}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Review Dialog */}
      {selectedRequest && (
        <Dialog
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          maxWidth="md"
          title="Duyệt đơn xin nghỉ phép"
          description={`Nhân sự: ${selectedRequest.employee?.fullName || selectedRequest.employee?.email}`}
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Thời gian:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedRequest.start_date} ➔ {selectedRequest.end_date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Tổng ngày:</span>
                <span className="font-bold text-[#4F75FF]">
                  {Number(selectedRequest.total_days).toFixed(1)} ngày
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Lý do:</span>
                <span className="text-[#0F172A]">
                  {selectedRequest.reason || "Không ghi chú"}
                </span>
              </div>
            </div>

            {actionFeedback && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                <span>{actionFeedback}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Ý kiến phản hồi / Nhận xét của người duyệt
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Nhập phản hồi nếu có..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleReviewSubmit("rejected")}
                disabled={actionLoading}
              >
                Từ chối
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleReviewSubmit("approved")}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                Duyệt đơn
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
