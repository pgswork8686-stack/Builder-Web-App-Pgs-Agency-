"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  FileSpreadsheet,
  Users,
  AlertCircle,
  AlertTriangle,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  attendanceApi,
  type AttendanceRecord,
  type AttendanceSummary,
} from "@/lib/api/attendance";
import { organizationApi } from "@/lib/api/organization";
import { getMe } from "@/lib/api/auth";
import { SectionHeader } from "@/components/dashboard/section-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export default function AccountantAttendancePage() {
  const [activeTab, setActiveTab] = useState<"company" | "personal">("company");

  // Company directory states
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter dropdown options
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

  // Personal attendance states
  const [user, setUser] = useState<any>(null);
  const [personalSummary, setPersonalSummary] =
    useState<AttendanceSummary | null>(null);
  const [personalHistory, setPersonalHistory] = useState<AttendanceRecord[]>(
    [],
  );
  const [personalHistoryTotal, setPersonalHistoryTotal] = useState(0);
  const [personalPage, setPersonalPage] = useState(1);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load departments & teams for filters
  const loadMetadata = async () => {
    try {
      const [deptsRes, teamsRes] = await Promise.all([
        organizationApi.getDepartments().catch(() => []),
        organizationApi.getTeams().catch(() => []),
      ]);
      setDepartments(deptsRes || []);
      setTeams(teamsRes || []);
    } catch (err: any) {
      console.error("Lỗi tải danh mục:", err);
    }
  };

  // Load company records
  const loadCompanyRecords = useCallback(async () => {
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
      setRecords(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error("Lỗi tải bảng chấm công:", err);
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo, filterTeam, filterDept, filterStatus, page]);

  // Load personal data
  const loadPersonalData = async () => {
    try {
      setPersonalLoading(true);
      const [me, sum] = await Promise.all([
        getMe().catch(() => null),
        attendanceApi.getSummary().catch(() => null),
      ]);
      setUser(me);
      setPersonalSummary(sum);

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
      }
    } catch (err: any) {
      console.error("Lỗi thông tin cá nhân:", err);
    } finally {
      setPersonalLoading(false);
    }
  };

  const loadPersonalHistory = async (p: number) => {
    try {
      const res = await attendanceApi.getMyHistory({ page: p, pageSize: 10 });
      setPersonalHistory(res.items || []);
      setPersonalHistoryTotal(res.total || 0);
    } catch (err: any) {
      console.error("Lỗi lịch sử cá nhân:", err);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (activeTab === "company") {
      loadCompanyRecords();
    } else {
      loadPersonalData();
      loadPersonalHistory(personalPage);
    }
  }, [activeTab, loadCompanyRecords, personalPage]);

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
        note: personalNote.trim() || undefined,
      });

      setFeedback({
        type: "success",
        message: `Check-in thành công lúc ${
          record.check_in_at
            ? new Date(record.check_in_at).toLocaleTimeString("vi-VN")
            : "vừa xong"
        }`,
      });
      setPersonalNote("");
      loadPersonalData();
      loadPersonalHistory(personalPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Check-in thất bại.",
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
        note: personalNote.trim() || undefined,
      });

      setFeedback({
        type: "success",
        message: `Check-out thành công lúc ${
          record.check_out_at
            ? new Date(record.check_out_at).toLocaleTimeString("vi-VN")
            : "vừa xong"
        }`,
      });
      setPersonalNote("");
      loadPersonalData();
      loadPersonalHistory(personalPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Check-out thất bại.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge variant="success" size="sm">
            Đúng giờ
          </Badge>
        );
      case "late":
        return (
          <Badge variant="warning" size="sm">
            Đi muộn
          </Badge>
        );
      case "early_leave":
        return (
          <Badge variant="warning" size="sm">
            Về sớm
          </Badge>
        );
      case "late_and_early_leave":
        return (
          <Badge variant="danger" size="sm">
            Muộn & Về sớm
          </Badge>
        );
      case "incomplete":
        return (
          <Badge variant="default" size="sm">
            Chưa hoàn tất
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Quản lý Chấm công & Ngày công (Kế toán)"
        description="Đối soát dữ liệu vào ca, thời gian làm việc toàn công ty phục vụ hạch toán bảng lương."
        badge={`${total} Bản ghi chấm công`}
        action={
          <div className="flex items-center gap-1 bg-[#F6F8FC] p-1 rounded-xl border border-[#EDF2F7]">
            <button
              onClick={() => setActiveTab("company")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "company"
                  ? "bg-white text-[#5D87FF] shadow-xs"
                  : "text-[#7C879D] hover:text-[#24304A]"
              }`}
            >
              Toàn công ty
            </button>
            <button
              onClick={() => setActiveTab("personal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "personal"
                  ? "bg-white text-[#5D87FF] shadow-xs"
                  : "text-[#7C879D] hover:text-[#24304A]"
              }`}
            >
              Chấm công của tôi
            </button>
          </div>
        }
      />

      {activeTab === "company" ? (
        <>
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[#EDF2F7] shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7C879D] mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => {
                    setFilterFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] outline-none focus:bg-white focus:border-[#5D87FF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7C879D] mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => {
                    setFilterTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] outline-none focus:bg-white focus:border-[#5D87FF]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7C879D] mb-1">
                  Phòng ban
                </label>
                <select
                  value={filterDept}
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] outline-none focus:bg-white focus:border-[#5D87FF]"
                >
                  <option value="">-- Mọi phòng ban --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7C879D] mb-1">
                  Đội nhóm (Team)
                </label>
                <select
                  value={filterTeam}
                  onChange={(e) => {
                    setFilterTeam(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] outline-none focus:bg-white focus:border-[#5D87FF]"
                >
                  <option value="">-- Mọi nhóm --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#7C879D] mb-1">
                  Trạng thái
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] outline-none focus:bg-white focus:border-[#5D87FF]"
                >
                  <option value="">-- Mọi trạng thái --</option>
                  <option value="present">Đúng giờ</option>
                  <option value="late">Đi muộn</option>
                  <option value="early_leave">Về sớm</option>
                  <option value="late_and_early_leave">Muộn & Về sớm</option>
                  <option value="incomplete">Chưa hoàn tất</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-8 h-8 text-[#5D87FF]" />}
              title="Không có dữ liệu chấm công"
              description="Không tìm thấy bản ghi chấm công nào phù hợp với bộ lọc đã chọn."
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Nhân sự</TableHeaderCell>
                    <TableHeaderCell>Ngày chấm</TableHeaderCell>
                    <TableHeaderCell>Giờ vào (Check-in)</TableHeaderCell>
                    <TableHeaderCell>Giờ ra (Check-out)</TableHeaderCell>
                    <TableHeaderCell>Thời lượng</TableHeaderCell>
                    <TableHeaderCell>Trạng thái</TableHeaderCell>
                    <TableHeaderCell>Ghi chú</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r) => {
                    const emp = r.employee;
                    const hours = r.work_minutes
                      ? (r.work_minutes / 60).toFixed(1)
                      : null;

                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#5D87FF] font-bold text-xs flex items-center justify-center border border-[#E0E7FF]">
                              {(emp?.full_name || emp?.work_email || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <span className="block font-bold text-xs text-[#24304A]">
                                {emp?.full_name || "Chưa có tên"}
                              </span>
                              <span className="block text-[11px] text-[#7C879D] font-mono">
                                {emp?.work_email || emp?.employee_code || "—"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs font-bold text-[#24304A]">
                          {r.attendance_date}
                        </TableCell>

                        <TableCell className="text-xs">
                          {r.check_in_at ? (
                            <span className="font-mono font-bold text-[#13DEB9]">
                              {new Date(r.check_in_at).toLocaleTimeString(
                                "vi-VN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          ) : (
                            <span className="text-[#7C879D]">—</span>
                          )}
                          {r.late_minutes ? (
                            <span className="block text-[10px] text-amber-600 font-medium">
                              (Muộn {r.late_minutes}p)
                            </span>
                          ) : null}
                        </TableCell>

                        <TableCell className="text-xs">
                          {r.check_out_at ? (
                            <span className="font-mono font-bold text-[#5D87FF]">
                              {new Date(r.check_out_at).toLocaleTimeString(
                                "vi-VN",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          ) : (
                            <span className="text-[#7C879D]">—</span>
                          )}
                          {r.early_leave_minutes ? (
                            <span className="block text-[10px] text-amber-600 font-medium">
                              (Sớm {r.early_leave_minutes}p)
                            </span>
                          ) : null}
                        </TableCell>

                        <TableCell className="text-xs font-mono font-bold text-[#24304A]">
                          {hours ? `${hours} giờ` : "—"}
                        </TableCell>

                        <TableCell>{getStatusBadge(r.status)}</TableCell>

                        <TableCell className="text-xs text-[#7C879D] max-w-[200px] truncate">
                          {r.check_in_note || r.check_out_note || "—"}
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
            <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#7C879D]">
              <span>
                Trang {page} / {totalPages} ({total} bản ghi)
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
        </>
      ) : (
        /* Personal Attendance Tab */
        <div className="space-y-6">
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
              value={`${personalSummary?.monthly?.presentDays ?? 0} ngày`}
              subtitle={`Tổng lượt: ${personalSummary?.monthly?.totalRecords ?? 0}`}
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              variant="blue"
              title="Hôm nay"
              value={
                personalSummary?.today?.checkedIn ? "Đã vào ca" : "Chưa vào ca"
              }
              subtitle={
                personalSummary?.today?.workMinutes
                  ? `${(personalSummary.today.workMinutes / 60).toFixed(1)} giờ làm việc`
                  : "Chuẩn: 8h/ngày"
              }
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              variant="gold"
              title="Lượt đi muộn"
              value={`${personalSummary?.monthly?.lateCount ?? 0} lần`}
              subtitle="Ghi nhận trong tháng"
              icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            />
            <StatCard
              variant="rose"
              title="Chưa hoàn tất ca"
              value={`${personalSummary?.monthly?.incompleteCount ?? 0} lần`}
              subtitle="Quên check-out"
              icon={<LogOut className="w-5 h-5 text-rose-500" />}
            />
          </div>

          {/* Action Box */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#24304A] tracking-tight">
                    Điểm danh ca làm việc cá nhân
                  </h3>
                  <p className="text-xs text-[#7C879D]">
                    Hệ thống tự động đối chiếu GPS vị trí làm việc.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin
                    className={`w-4 h-4 ${
                      geoCoords
                        ? "text-[#13DEB9]"
                        : "text-amber-500 animate-pulse"
                    }`}
                  />
                  <span className="text-xs font-mono font-bold text-[#24304A]">
                    {geoCoords
                      ? `${geoCoords.latitude.toFixed(4)}, ${geoCoords.longitude.toFixed(4)}`
                      : geoError || "Đang lấy GPS..."}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#24304A]">
                  Ghi chú chấm công
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú ca làm, làm bù hoặc công tác..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#F6F8FC] border border-[#EDF2F7] text-xs text-[#24304A] placeholder-[#7C879D] outline-none focus:bg-white focus:border-[#5D87FF] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCheckIn}
                  isLoading={actionLoading}
                  disabled={
                    actionLoading || personalSummary?.today?.checkedIn || !geoCoords
                  }
                  leftIcon={<LogIn className="w-4 h-4" />}
                >
                  Vào ca (Check-in)
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleCheckOut}
                  isLoading={actionLoading}
                  disabled={
                    actionLoading ||
                    !personalSummary?.today?.checkedIn ||
                    !!personalSummary?.today?.checkOutAt ||
                    !geoCoords
                  }
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Kết thúc ca (Check-out)
                </Button>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h4 className="font-bold text-sm text-[#24304A]">
                Thông tin ca hôm nay
              </h4>
              <div className="space-y-3 text-xs border-t border-[#EDF2F7] pt-3">
                <div className="flex justify-between">
                  <span className="text-[#7C879D]">Trạng thái:</span>
                  <span>
                    {personalSummary?.today?.status
                      ? getStatusBadge(personalSummary.today.status)
                      : "Chưa điểm danh"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7C879D]">Check-in:</span>
                  <span className="font-mono font-bold text-[#24304A]">
                    {personalSummary?.today?.checkInAt
                      ? new Date(
                          personalSummary.today.checkInAt,
                        ).toLocaleTimeString("vi-VN")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7C879D]">Check-out:</span>
                  <span className="font-mono font-bold text-[#24304A]">
                    {personalSummary?.today?.checkOutAt
                      ? new Date(
                          personalSummary.today.checkOutAt,
                        ).toLocaleTimeString("vi-VN")
                      : "—"}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
