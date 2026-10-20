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

/** YYYY-MM-DD in the browser's local calendar (toISOString() shifts the day in UTC+7). */
function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function currentMonthRange(now = new Date()) {
  return {
    from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

type LeaveStats = { pending: number; approved: number; rejected: number };

export default function AdminLeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [statsError, setStatsError] = useState(false);

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
      const { from, to } = currentMonthRange();
      const events = await leaveApi.getCalendar(from, to);
      setCalendarEvents(events);
    } catch (err) {
      console.error(err);
    } finally {
      setCalendarLoading(false);
    }
  };

  // KPI cards come from the API, independent of the list filter below.
  const loadStats = async () => {
    try {
      setStatsError(false);
      const { from, to } = currentMonthRange();
      const [pending, approved, rejected] = await Promise.all([
        leaveApi.getDirectory({ status: "pending", page: 1, pageSize: 1 }),
        leaveApi.getDirectory({
          status: "approved",
          from,
          to,
          page: 1,
          pageSize: 1,
        }),
        leaveApi.getDirectory({
          status: "rejected",
          from,
          to,
          page: 1,
          pageSize: 1,
        }),
      ]);
      setStats({
        pending: pending.total,
        approved: approved.total,
        rejected: rejected.total,
      });
    } catch (err) {
      console.error(err);
      setStats(null);
      setStatsError(true);
    }
  };

  // People whose approved leave covers today (distinct employees).
  const today = localDate(new Date());
  const onLeaveNow = new Set(
    calendarEvents
      .filter((evt) => evt.startDate <= today && today <= evt.endDate)
      .map((evt) => evt.userId ?? evt.id),
  ).size;
  const kpi = (value: number | undefined) =>
    value === undefined ? "—" : String(value).padStart(2, "0");

  useEffect(() => {
    loadRequests();
  }, [page, statusFilter]);

  useEffect(() => {
    loadCalendar();
    loadStats();
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
      await loadStats();
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
          value={kpi(stats?.pending)}
          subtitle={statsError ? "Không tải được" : "Tất cả đơn đang chờ"}
        />
        <StatCard
          variant="green"
          title="Đã duyệt"
          value={kpi(stats?.approved)}
          subtitle={statsError ? "Không tải được" : "Nghỉ trong tháng này"}
        />
        <StatCard
          variant="rose"
          title="Từ chối"
          value={kpi(stats?.rejected)}
          subtitle={statsError ? "Không tải được" : "Nghỉ trong tháng này"}
        />
        <StatCard
          variant="blue"
          title="Đang nghỉ"
          value={calendarLoading ? "—" : String(onLeaveNow).padStart(2, "0")}
          subtitle="Hôm nay"
        />
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-[#3453D1]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#5B6B82]">
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
                  ? "bg-[#3F63D6] text-white shadow-xs"
                  : "bg-[#F8FAFC] text-[#5B6B82] hover:bg-[#F1F5F9] border border-[#E2E8F0]"
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
              <span className="text-xs text-[#5B6B82]">
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
                icon={<Calendar className="w-8 h-8 text-[#3453D1]" />}
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
                          <div className="text-[11px] text-[#5B6B82]">
                            {req.employee?.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-[#5B6B82]">
                          {req.leave_type?.name || "Phép năm"}
                        </TableCell>
                        <TableCell className="text-xs text-[#0F172A]">
                          {req.start_date} ➔ {req.end_date}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-[#3453D1]">
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
                            <span className="text-xs text-[#5F6E85]">
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
              <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#5B6B82]">
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
                <Calendar className="w-4 h-4 text-[#3453D1]" />
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
                <p className="text-center py-6 text-xs text-[#5B6B82]">
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
                    <div className="text-[11px] text-[#5B6B82]">
                      {evt.leaveType}
                    </div>
                    <div className="text-[11px] text-[#3453D1] font-semibold">
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
                <span className="text-[#5B6B82]">Thời gian:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedRequest.start_date} ➔ {selectedRequest.end_date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Tổng ngày:</span>
                <span className="font-bold text-[#3453D1]">
                  {Number(selectedRequest.total_days).toFixed(1)} ngày
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B82]">Lý do:</span>
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5B6B82]">
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
