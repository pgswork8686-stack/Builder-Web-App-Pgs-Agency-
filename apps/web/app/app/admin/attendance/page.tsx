"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  Sliders,
} from "lucide-react";
import { attendanceApi, type AttendanceRecord } from "@/lib/api/attendance";
import { organizationApi } from "@/lib/api/organization";
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

export default function AdminAttendancePage() {
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
      const [deptsRes, teamsRes] = await Promise.all([
        organizationApi.getDepartments(),
        organizationApi.getTeams(),
      ]);
      setDepartments(deptsRes);
      setTeams(teamsRes);
    } catch (err: any) {
      console.error(err);
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
  }, [page, filterFrom, filterTo, filterTeam, filterDept, filterStatus]);

  const handleOpenAdjust = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setAdjustCheckIn(
      rec.check_in_at
        ? new Date(rec.check_in_at).toISOString().slice(0, 16)
        : "",
    );
    setAdjustCheckOut(
      rec.check_out_at
        ? new Date(rec.check_out_at).toISOString().slice(0, 16)
        : "",
    );
    setAdjustStatus(rec.status);
    setAdjustReason("");
    setAdjustFeedback(null);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
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
    <div className="space-y-6">
      {/* Top Header matching Figma: Duyệt và chốt bảng công.png */}
      <SectionHeader
        title="Kiểm tra bảng công"
        description="Manager duyệt đội nhóm; Kế toán xác nhận và khóa để tính lương."
        badge="Chấm công & Chốt lương"
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

      {/* 4 Pastel Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          variant="gold"
          title="Chờ Manager"
          value="07"
          subtitle="Cần duyệt"
        />
        <StatCard
          variant="blue"
          title="Chờ Kế toán"
          value="12"
          subtitle="Đã qua Manager"
        />
        <StatCard
          variant="rose"
          title="Sai lệch"
          value="03"
          subtitle="Cần bổ sung"
        />
        <StatCard
          variant="green"
          title="Đã khóa"
          value="24"
          subtitle="Tháng này"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
            Từ ngày
          </label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => {
              setFilterFrom(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
            Đến ngày
          </label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => {
              setFilterTo(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
            Phòng ban
          </label>
          <select
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
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
          <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
            Đội nhóm
          </label>
          <select
            value={filterTeam}
            onChange={(e) => {
              setFilterTeam(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
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
          <label className="block text-[11px] font-bold text-[#64748B] uppercase mb-1">
            Trạng thái
          </label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="present">Đúng giờ (Present)</option>
            <option value="late">Đi muộn (Late)</option>
            <option value="early_leave">Về sớm (Early leave)</option>
            <option value="incomplete">Chưa check-out</option>
            <option value="absent">Vắng mặt (Absent)</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-3">
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Kiểm tra bảng công ({total} lượt)
          </h3>
          <span className="text-xs text-[#64748B]">
            Trang {page} / {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8 text-[#4F75FF]" />}
            title="Không tìm thấy bản ghi chấm công"
            description="Chưa có dữ liệu chấm công nào khớp với bộ lọc tìm kiếm."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nhân sự</TableHeaderCell>
                  <TableHeaderCell>Ngày</TableHeaderCell>
                  <TableHeaderCell>Giờ vào</TableHeaderCell>
                  <TableHeaderCell>Giờ ra</TableHeaderCell>
                  <TableHeaderCell>Thời lượng</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Hiệu chỉnh
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <div className="font-bold text-[#0F172A]">
                        {rec.employee?.full_name || "Nhân viên"}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {rec.employee?.work_email}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-[#0F172A]">
                      {rec.attendance_date}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B]">
                      {formatVietnamTime(rec.check_in_at)}
                    </TableCell>
                    <TableCell className="text-xs text-[#64748B]">
                      {formatVietnamTime(rec.check_out_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-[#4F75FF]">
                      {rec.work_minutes
                        ? `${(rec.work_minutes / 60).toFixed(1)}h`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          rec.status === "present"
                            ? "success"
                            : rec.status === "late"
                              ? "gold"
                              : rec.status === "absent"
                                ? "danger"
                                : "blue"
                        }
                        size="sm"
                      >
                        {rec.status ? rec.status.toUpperCase() : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAdjust(rec)}
                        className="text-[#4F75FF] hover:bg-[#EEF2FF]"
                      >
                        Hiệu chỉnh
                      </Button>
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
            <span>Tổng số {total} bản ghi</span>
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

      {/* Adjust Dialog */}
      {selectedRecord && (
        <Dialog
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          maxWidth="md"
          title="Hiệu chỉnh công nhân sự"
          description={`Nhân sự: ${selectedRecord.employee?.full_name || selectedRecord.employee?.work_email}`}
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-2">
            {adjustFeedback && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
                <span>{adjustFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Giờ vào (Check-in)
                </label>
                <input
                  type="datetime-local"
                  value={adjustCheckIn}
                  onChange={(e) => setAdjustCheckIn(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                  Giờ ra (Check-out)
                </label>
                <input
                  type="datetime-local"
                  value={adjustCheckOut}
                  onChange={(e) => setAdjustCheckOut(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Trạng thái chấm công
              </label>
              <select
                value={adjustStatus}
                onChange={(e) => setAdjustStatus(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              >
                <option value="present">Đúng giờ (Present)</option>
                <option value="late">Đi muộn (Late)</option>
                <option value="early_leave">Về sớm (Early leave)</option>
                <option value="incomplete">Chưa hoàn tất (Incomplete)</option>
                <option value="absent">Vắng mặt (Absent)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                Lý do hiệu chỉnh *
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="VD: Quên check-out khi ra về, có xác nhận của trưởng nhóm..."
                rows={3}
                required
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                disabled={adjusting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={adjusting}
              >
                Lưu hiệu chỉnh
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
