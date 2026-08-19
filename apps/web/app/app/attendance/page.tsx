"use client";

import React, { useEffect, useState } from "react";
import {
  Clock,
  MapPin,
  History,
  AlertCircle,
  CheckCircle,
  LogIn,
  LogOut,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { getMe } from "@/lib/api/auth";
import {
  attendanceApi,
  AttendanceRecord,
  AttendanceSummary,
} from "@/lib/api/attendance";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function EmployeeAttendancePage() {
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Geolocation states
  const [geoCoords, setGeoCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Form input notes
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination filters
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadUserAndSummary = async () => {
    try {
      setLoading(true);
      const me = await getMe();
      setUser(me);

      const sum = await attendanceApi.getSummary();
      setSummary(sum);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGeoCoords({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (err) => {
            setGeoError("Không thể định vị GPS: " + err.message);
          },
        );
      } else {
        setGeoError("Trình duyệt không hỗ trợ định vị Geolocation.");
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Không thể tải dữ liệu chấm công.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (page: number) => {
    try {
      setHistoryLoading(true);
      const res = await attendanceApi.getMyHistory({ page, pageSize });
      setHistory(res.items);
      setHistoryTotal(res.total);
    } catch (err: any) {
      console.error("Lỗi lịch sử:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadUserAndSummary();
    loadHistory(currentPage);
  }, [currentPage]);

  const handleCheckIn = async () => {
    if (!geoCoords) {
      setFeedback({
        type: "error",
        message: "Chưa có tọa độ GPS. Vui lòng cấp quyền vị trí trình duyệt.",
      });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);
      const record = await attendanceApi.checkIn({
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
        note: note.trim() || undefined,
      });

      setFeedback({
        type: "success",
        message: `Check-in thành công lúc ${
          record.check_in_at
            ? new Date(record.check_in_at).toLocaleTimeString("vi-VN")
            : "bây giờ"
        }`,
      });
      setNote("");
      loadUserAndSummary();
      loadHistory(currentPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Check-in thất bại. Vui lòng thử lại.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!geoCoords) {
      setFeedback({
        type: "error",
        message: "Chưa có tọa độ GPS. Vui lòng cấp quyền vị trí trình duyệt.",
      });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);
      const record = await attendanceApi.checkOut({
        latitude: geoCoords.latitude,
        longitude: geoCoords.longitude,
        note: note.trim() || undefined,
      });

      setFeedback({
        type: "success",
        message: `Check-out thành công lúc ${
          record.check_out_at
            ? new Date(record.check_out_at).toLocaleTimeString("vi-VN")
            : "bây giờ"
        }`,
      });
      setNote("");
      loadUserAndSummary();
      loadHistory(currentPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Check-out thất bại. Vui lòng thử lại.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(historyTotal / pageSize);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Chấm công Cá nhân (Attendance Hub)"
        description="Ghi nhận ca làm việc, định vị GPS địa điểm và kiểm tra lịch sử công tháng."
        badge="Live GPS Tracking"
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          variant="green"
          title="Ngày công ghi nhận"
          value={`${summary?.monthly?.presentDays ?? 0} ngày`}
          subtitle={`Tổng số lượt: ${summary?.monthly?.totalRecords ?? 0}`}
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          variant="blue"
          title="Hôm nay"
          value={summary?.today?.checkedIn ? "Đã vào ca" : "Chưa vào ca"}
          subtitle={
            summary?.today?.workMinutes
              ? `${(summary.today.workMinutes / 60).toFixed(1)} giờ làm việc`
              : "Chuẩn: 8h/ngày"
          }
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          variant="gold"
          title="Lượt đi muộn"
          value={`${summary?.monthly?.lateCount ?? 0} lần`}
          subtitle="Ghi nhận trong tháng"
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          variant="rose"
          title="Chưa hoàn tất ca"
          value={`${summary?.monthly?.incompleteCount ?? 0} lần`}
          subtitle="Quên check-out"
          icon={<LogOut className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* Main Check-in Action Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EDF2F7] pb-4 gap-2">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                Điểm danh ca làm việc
              </h3>
              <p className="text-xs text-[#64748B]">
                Văn phòng: <span className="font-medium text-[#0F172A]">Tầng 2, DM 2-25, điểm TTCN làng nghề dệt lụa Vạn Phúc, Vạn Phúc, Hà Đông, Hà Nội</span>
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] self-start sm:self-auto">
              <MapPin
                className={`w-4 h-4 ${
                  geoCoords ? "text-[#00D09C]" : "text-amber-500 animate-pulse"
                }`}
              />
              <span className="text-xs font-mono font-bold text-[#0F172A]">
                {geoCoords
                  ? `${geoCoords.latitude.toFixed(4)}, ${geoCoords.longitude.toFixed(4)}`
                  : geoError || "Đang lấy GPS..."}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Ghi chú chấm công (Tùy chọn)
            </label>
            <input
              type="text"
              placeholder="VD: Đi công tác tại cơ quan khách hàng, làm ngoài giờ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#4F75FF] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full h-14 text-sm"
              disabled={actionLoading || !geoCoords}
              isLoading={actionLoading}
              onClick={handleCheckIn}
              leftIcon={<LogIn className="w-5 h-5" />}
            >
              VÀO CA (CHECK-IN)
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full h-14 text-sm hover:border-amber-500/40 hover:text-amber-600"
              disabled={actionLoading || !geoCoords}
              isLoading={actionLoading}
              onClick={handleCheckOut}
              leftIcon={<LogOut className="w-5 h-5" />}
            >
              TAN CA (CHECK-OUT)
            </Button>
          </div>
        </Card>

        {/* Shift Policy Card */}
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#4F75FF]">
            Quy định ca làm việc
          </h4>
          <div className="space-y-3 text-xs text-[#64748B]">
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Ca sáng:</span>
              <span className="font-bold text-[#0F172A]">08:30 — 12:00</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Nghỉ trưa:</span>
              <span className="font-bold text-[#0F172A]">12:00 — 13:30</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Ca chiều:</span>
              <span className="font-bold text-[#0F172A]">13:30 — 18:00</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Bán kính GPS hợp lệ:</span>
              <span className="font-bold text-[#00B788]">≤ 100 mét</span>
            </div>
          </div>
        </Card>
      </div>

      {/* History Table */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#0F172A]">
          Lịch sử chấm công gần đây ({historyTotal} lượt)
        </h3>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={<History className="w-8 h-8 text-[#4F75FF]" />}
            title="Chưa có dữ liệu chấm công"
            description="Lịch sử chấm công của bạn trong tháng này sẽ xuất hiện tại đây sau khi check-in."
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Ngày</TableHeaderCell>
                  <TableHeaderCell>Giờ vào (Check-in)</TableHeaderCell>
                  <TableHeaderCell>Giờ ra (Check-out)</TableHeaderCell>
                  <TableHeaderCell>Thời gian làm</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Ghi chú</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((rec) => {
                  const isLate = rec.status === "late";
                  const checkInTime = rec.check_in_at
                    ? new Date(rec.check_in_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                  const checkOutTime = rec.check_out_at
                    ? new Date(rec.check_out_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-bold text-[#0F172A]">
                        {rec.attendance_date}
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {checkInTime}
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {checkOutTime}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-[#4F75FF]">
                        {rec.work_minutes
                          ? `${(rec.work_minutes / 60).toFixed(1)}h`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rec.status === "present"
                              ? "success"
                              : isLate
                                ? "warning"
                                : "default"
                          }
                          size="sm"
                        >
                          {rec.status ? rec.status.toUpperCase() : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#64748B]">
                        {rec.check_in_note || rec.check_out_note || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[#1C1C1E] text-xs text-[#8E8E93]">
            <span>
              Trang {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
