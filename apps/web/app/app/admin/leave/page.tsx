"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  ListFilter,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { getMe } from "@/lib/api/auth";
import { leaveApi, LeaveRequest } from "@/lib/api/leave";

export default function AdminLeavePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
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

  const loadUser = async () => {
    try {
      const me = await getMe();
      setCurrentUser(me);
    } catch (err) {
      console.error(err);
    }
  };

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
      // Load current month's events
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
    loadUser();
  }, []);

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
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-[#151516] pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Phê Duyệt Nghỉ Phép Nhân Sự
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Xét duyệt đơn xin nghỉ phép của nhân sự, quản lý và đối soát số dư
              ngày phép khả dụng.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151516] hover:bg-[#1f1f22] text-xs font-bold border border-[#151516]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </Link>
          </div>
        </div>

        {/* Filters and List view tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516]">
          <div className="flex items-center gap-3">
            <ListFilter className="w-4 h-4 text-[#FFC400]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#606060]">
              Lọc danh sách
            </span>
          </div>

          <div className="flex gap-2 text-xs">
            {["pending", "approved", "rejected", "cancelled", ""].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                    statusFilter === status
                      ? "bg-[#FFC400] border-transparent text-black"
                      : "bg-[#151516] border-[#FFC400]/20 text-[#FFF8E6]/80 hover:bg-[#1f1f22]"
                  }`}
                >
                  {status === "pending"
                    ? "Chờ duyệt"
                    : status === "approved"
                      ? "Đã duyệt"
                      : status === "rejected"
                        ? "Từ chối"
                        : status === "cancelled"
                          ? "Đã hủy"
                          : "Tất cả"}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
            <h2 className="text-lg font-bold text-white">
              Danh sách đơn xin nghỉ
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#151516] text-[#606060]">
                    <th className="py-3 px-4 uppercase font-semibold">
                      Nhân sự
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">
                      Thời gian
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">
                      Số ngày
                    </th>
                    <th className="py-3 px-4 uppercase font-semibold">Lý do</th>
                    <th className="py-3 px-4 uppercase font-semibold text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151516]/50">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-[#606060]"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FFC400]" />
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-[#606060]"
                      >
                        Không tìm thấy đơn nghỉ phép nào.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-[#151516]/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">
                            {req.employee?.fullName}
                          </div>
                          <div className="text-[10px] text-[#606060]">
                            {req.employee?.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#FFF8E6]/80">
                          {req.start_date} ~ {req.end_date}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {Number(req.total_days).toFixed(1)} ngày
                        </td>
                        <td className="py-3.5 px-4 text-[#FFF8E6]/70 truncate max-w-[120px]">
                          {req.reason || "--"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {req.status === "pending" && (
                            <button
                              onClick={() => handleOpenReview(req)}
                              className="px-3 py-1.5 rounded-lg bg-[#FFC400] text-black font-extrabold text-[10px] transition-all hover:brightness-105"
                            >
                              Xét duyệt
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[#151516] text-xs">
                <span className="text-[#606060]">Tổng số {total} đơn</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg bg-[#151516] disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="self-center font-bold">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg bg-[#151516] disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Calendar View Overview (Right Pane) */}
          <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4 h-fit">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FFC400]" />
              Lịch nghỉ phép được duyệt
            </h2>

            <div className="space-y-3">
              {calendarLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FFC400]" />
              ) : calendarEvents.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#606060]">
                  Không có ai nghỉ phép trong tháng này.
                </div>
              ) : (
                calendarEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl bg-[#151516] border border-[#FFC400]/10 text-xs"
                  >
                    <div className="font-bold text-white">{evt.fullName}</div>
                    <div className="text-[#606060] mt-0.5">{evt.leaveType}</div>
                    <div className="text-amber-500 mt-1 font-semibold">
                      {evt.startDate} ~ {evt.endDate}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal: Review dialog */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="max-w-md w-full bg-[#0E0E0F] border border-[#151516] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Duyệt đơn xin nghỉ phép
                </h3>
                <p className="text-xs text-[#606060] mt-1">
                  Nhân sự: {selectedRequest.employee?.fullName} (
                  {selectedRequest.employee?.email})
                </p>
                <div className="mt-2 p-3 bg-[#151516] rounded-xl text-xs space-y-1">
                  <div>
                    Đăng ký nghỉ:{" "}
                    <span className="font-bold text-white">
                      {selectedRequest.start_date} ~ {selectedRequest.end_date}
                    </span>
                  </div>
                  <div>
                    Tổng thời gian:{" "}
                    <span className="font-bold text-[#FFC400]">
                      {Number(selectedRequest.total_days).toFixed(1)} ngày
                    </span>
                  </div>
                  <div>
                    Lý do:{" "}
                    <span className="text-[#FFF8E6]/80">
                      {selectedRequest.reason || "Không ghi chú"}
                    </span>
                  </div>
                </div>
              </div>

              {actionFeedback && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{actionFeedback}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Ý kiến phản hồi / Nhận xét của người duyệt
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Nhập phản hồi nếu có..."
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-3 text-white placeholder-[#606060] min-h-[80px] focus:outline-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => handleReviewSubmit("rejected")}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewSubmit("approved")}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl bg-[#FFC400] text-black font-extrabold"
                  >
                    Duyệt đơn
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="w-full py-2.5 text-center text-[#606060] hover:text-white font-semibold transition-colors mt-2"
                >
                  Hủy thao tác
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
