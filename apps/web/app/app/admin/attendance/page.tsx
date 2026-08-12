"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  ShieldAlert,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { getMe } from "@/lib/api/auth";
import { attendanceApi, AttendanceRecord } from "@/lib/api/attendance";
import { organizationApi } from "@/lib/api/organization";

export default function AdminAttendancePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Lists for dropdown options
  const [departments, setDepartments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Filtering states
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Correction Adjustment Form States
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(
    null,
  );
  const [adjustCheckIn, setAdjustCheckIn] = useState("");
  const [adjustCheckOut, setAdjustCheckOut] = useState("");
  const [adjustStatus, setAdjustStatus] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustFeedback, setAdjustFeedback] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const loadUserAndMetadata = async () => {
    try {
      setLoading(true);
      const me = await getMe();
      setCurrentUser(me);

      const deptsRes = await organizationApi.getDepartments();
      setDepartments(deptsRes);

      const teamsRes = await organizationApi.getTeams();
      setTeams(teamsRes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getDirectory({
        from: filterFrom || undefined,
        to: filterTo || undefined,
        teamId: filterTeam || undefined,
        departmentId: filterDept || undefined,
        status: filterStatus || undefined,
        page,
        pageSize,
      });

      setRecords(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Lỗi lấy danh sách chấm công:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserAndMetadata();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [
    page,
    filterFrom,
    filterTo,
    filterTeam,
    filterDept,
    filterStatus,
    searchQuery,
  ]);

  const handleOpenAdjustment = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setAdjustCheckIn(
      record.check_in_at
        ? new Date(record.check_in_at).toISOString().slice(0, 16)
        : "",
    );
    setAdjustCheckOut(
      record.check_out_at
        ? new Date(record.check_out_at).toISOString().slice(0, 16)
        : "",
    );
    setAdjustStatus(record.status);
    setAdjustReason("");
    setAdjustFeedback(null);
  };

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!adjustReason || adjustReason.trim().length < 5) {
      setAdjustFeedback("Lý do điều chỉnh tối thiểu 5 ký tự.");
      return;
    }

    try {
      setAdjusting(true);
      setAdjustFeedback(null);

      await attendanceApi.adjustRecord(selectedRecord.id, {
        checkInAt: adjustCheckIn ? new Date(adjustCheckIn).toISOString() : null,
        checkOutAt: adjustCheckOut
          ? new Date(adjustCheckOut).toISOString()
          : null,
        status: adjustStatus,
        reason: adjustReason,
      });

      setSelectedRecord(null);
      await loadRecords();
    } catch (err: any) {
      setAdjustFeedback(err.message || "Lỗi lưu điều chỉnh.");
    } finally {
      setAdjusting(false);
    }
  };

  const formatVietnamTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="border-b border-[#151516] pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Quản Lý Chấm Công Nhân Sự
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Tra cứu danh sách chấm công toàn bộ doanh nghiệp, hiệu chỉnh sai
              sót và giám sát giờ làm việc.
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

        {/* Filter Toolbar */}
        <div className="p-5 rounded-2xl bg-[#0E0E0F] border border-[#151516] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase mb-1">
              Phòng ban
            </label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase mb-1">
              Đội nhóm
            </label>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">Tất cả đội nhóm</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#606060] uppercase mb-1">
              Trạng thái
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="present">Đúng giờ</option>
              <option value="late">Đi muộn</option>
              <option value="early_leave">Về sớm</option>
              <option value="incomplete">Chưa hoàn thành</option>
            </select>
          </div>
        </div>

        {/* Attendance Listing Table */}
        <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#151516] text-[#606060]">
                  <th className="py-3 px-4 uppercase font-semibold">Nhân sự</th>
                  <th className="py-3 px-4 uppercase font-semibold">Ngày</th>
                  <th className="py-3 px-4 uppercase font-semibold">
                    Check-in
                  </th>
                  <th className="py-3 px-4 uppercase font-semibold">
                    Check-out
                  </th>
                  <th className="py-3 px-4 uppercase font-semibold">
                    Thời gian làm
                  </th>
                  <th className="py-3 px-4 uppercase font-semibold">
                    Trạng thái
                  </th>
                  <th className="py-3 px-4 uppercase font-semibold text-right">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151516]/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#606060]">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FFC400]" />
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#606060]">
                      Không tìm thấy bản ghi chấm công nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  records.map((record: any) => (
                    <tr
                      key={record.id}
                      className="hover:bg-[#151516]/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">
                          {record.employee?.fullName || "Chưa xác định"}
                        </div>
                        <div className="text-[10px] text-[#606060]">
                          {record.employee?.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {record.attendance_date}
                      </td>
                      <td className="py-3.5 px-4 text-[#FFF8E6]/80">
                        {formatVietnamTime(record.check_in_at)}
                      </td>
                      <td className="py-3.5 px-4 text-[#FFF8E6]/80">
                        {formatVietnamTime(record.check_out_at)}
                      </td>
                      <td className="py-3.5 px-4 text-[#FFF8E6]/80">
                        {record.work_minutes
                          ? `${Math.floor(record.work_minutes / 60)}h ${record.work_minutes % 60}m`
                          : "--"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            record.status === "present"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : record.status === "late"
                                ? "bg-amber-500/10 text-amber-400"
                                : record.status === "incomplete"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {record.status === "present"
                            ? "Đúng giờ"
                            : record.status === "late"
                              ? "Đi muộn"
                              : record.status === "incomplete"
                                ? "Chưa Check-out"
                                : record.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenAdjustment(record)}
                          className="px-3 py-1.5 rounded-lg bg-[#151516] border border-[#FFC400]/20 hover:bg-[#1f1f22] text-[#FFC400] text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Hiệu chỉnh
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#151516] text-xs">
              <span className="text-[#606060]">Tổng số {total} bản ghi</span>
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

        {/* Modal: Adjustment form details */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="max-w-md w-full bg-[#0E0E0F] border border-[#151516] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Yêu cầu sửa đổi giờ công
                </h3>
                <p className="text-xs text-[#606060] mt-1">
                  Đang thao tác bản ghi chấm công ngày{" "}
                  {selectedRecord.attendance_date} của nhân sự:{" "}
                  {(selectedRecord as any).employee?.fullName}.
                </p>
              </div>

              {adjustFeedback && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{adjustFeedback}</span>
                </div>
              )}

              <form onSubmit={submitAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Check-in Mới
                  </label>
                  <input
                    type="datetime-local"
                    value={adjustCheckIn}
                    onChange={(e) => setAdjustCheckIn(e.target.value)}
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Check-out Mới
                  </label>
                  <input
                    type="datetime-local"
                    value={adjustCheckOut}
                    onChange={(e) => setAdjustCheckOut(e.target.value)}
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Trạng thái cưỡng chế
                  </label>
                  <select
                    value={adjustStatus}
                    onChange={(e) => setAdjustStatus(e.target.value)}
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-2.5 text-white focus:outline-none"
                  >
                    <option value="present">Đúng giờ (present)</option>
                    <option value="late">Đi muộn (late)</option>
                    <option value="early_leave">Về sớm (early_leave)</option>
                    <option value="incomplete">
                      Chưa hoàn thành (incomplete)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#606060] uppercase mb-1">
                    Lý do điều chỉnh (Mục kiểm toán bắt buộc)
                  </label>
                  <textarea
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Nhập lý do chi tiết..."
                    className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-3 text-white placeholder-[#606060] min-h-[60px] focus:outline-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 py-3 rounded-xl bg-[#151516] border border-[#151516] hover:bg-[#1f1f22] text-white font-bold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={adjusting}
                    className="flex-1 py-3 rounded-xl bg-[#FFC400] text-black font-extrabold"
                  >
                    {adjusting ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Áp dụng"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
