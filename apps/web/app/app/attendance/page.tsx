"use client";

import React, { useEffect, useState, useRef } from "react";
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
  Camera,
  UploadCloud,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import { getMe } from "@/lib/api/auth";
import {
  attendanceApi,
  AttendancePolicy,
  AttendanceRecord,
  AttendanceSummary,
  getAttendanceErrorMessage,
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
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Geolocation states
  const [geoCoords, setGeoCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Photo evidence states (required when policy.photoRequired is true)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSessionId, setPhotoSessionId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form input notes
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pagination filters
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const requestGeolocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
        });
        setGeoLoading(false);
      },
      (err) => {
        let msg = "Không thể lấy tọa độ GPS: " + err.message;
        if (err.code === 1) {
          msg = "Quyền truy cập vị trí bị từ chối. Vui lòng cấp quyền định vị.";
        } else if (err.code === 2) {
          msg = "Vị trí không khả dụng. Vui lòng kiểm tra GPS thiết bị.";
        } else if (err.code === 3) {
          msg = "Hết thời gian chờ lấy vị trí GPS.";
        }
        setGeoError(msg);
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  };

  const loadUserAndSummary = async () => {
    try {
      setLoading(true);
      const [me, sum, pol] = await Promise.all([
        getMe().catch(() => null),
        attendanceApi.getSummary().catch(() => null),
        attendanceApi.getPolicy().catch(() => null),
      ]);
      setUser(me);
      setSummary(sum);
      setPolicy(pol);

      // Trigger geolocation request
      requestGeolocation();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: getAttendanceErrorMessage(err),
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
      console.error("Lỗi tải lịch sử chấm công:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadUserAndSummary();
  }, []);

  useEffect(() => {
    loadHistory(currentPage);
  }, [currentPage]);

  // Clean up object URL preview on unmount or file change
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);

    // Validate mime type
    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setPhotoError(
        "Định dạng ảnh không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.",
      );
      return;
    }

    // Validate size <= 5MB
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Kích thước ảnh quá lớn. Dung lượng tối đa là 5 MB.");
      return;
    }

    // Set preview
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));

    // Upload immediately to acquire session ID
    try {
      setPhotoUploading(true);
      const signature = await attendanceApi.getPhotoUploadSignature(
        file.name,
        file.type,
        file.size,
      );

      // Upload binary to signed URL
      const uploadRes = await fetch(signature.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(
          `Tải ảnh lên máy chủ thất bại (HTTP ${uploadRes.status})`,
        );
      }

      setPhotoSessionId(signature.photoUploadSessionId);
    } catch (err: any) {
      console.error("Lỗi upload ảnh:", err);
      setPhotoError(err.message || "Không thể tải ảnh bằng chứng lên máy chủ.");
      setPhotoSessionId(null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleClearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoSessionId(null);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // State Machine determinations based on today summary
  const isCheckedIn = Boolean(summary?.today?.checkedIn);
  const isCompleted = Boolean(summary?.today?.checkOutAt);

  // Check if check-in is allowed
  const isLocationRequired = Boolean(policy?.locationRequired);
  const isPhotoRequired = Boolean(policy?.photoRequired);

  const canCheckIn =
    !isCheckedIn &&
    !isCompleted &&
    !actionLoading &&
    (!isLocationRequired || Boolean(geoCoords)) &&
    (!isPhotoRequired || (Boolean(photoSessionId) && !photoUploading));

  const canCheckOut =
    isCheckedIn &&
    !isCompleted &&
    !actionLoading &&
    (!isLocationRequired || Boolean(geoCoords)) &&
    (!isPhotoRequired || (Boolean(photoSessionId) && !photoUploading));

  const handleCheckIn = async () => {
    if (actionLoading) return;

    if (isLocationRequired && !geoCoords) {
      setFeedback({
        type: "error",
        message:
          "Chính sách yêu cầu tọa độ GPS. Vui lòng cấp quyền định vị trình duyệt.",
      });
      return;
    }

    if (isPhotoRequired && !photoSessionId) {
      setFeedback({
        type: "error",
        message:
          "Chính sách yêu cầu chụp ảnh bằng chứng. Vui lòng chụp hoặc tải ảnh.",
      });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);

      const record = await attendanceApi.checkIn({
        latitude: geoCoords?.latitude ?? null,
        longitude: geoCoords?.longitude ?? null,
        accuracyMeters: geoCoords?.accuracyMeters ?? null,
        photoUploadSessionId: photoSessionId ?? null,
        note: note.trim() || null,
      });

      setFeedback({
        type: "success",
        message: `Vào ca thành công lúc ${
          record.check_in_at
            ? new Date(record.check_in_at).toLocaleTimeString("vi-VN")
            : "bây giờ"
        }. Trạng thái: ${record.status.toUpperCase()}.`,
      });

      setNote("");
      handleClearPhoto();
      await loadUserAndSummary();
      await loadHistory(currentPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: getAttendanceErrorMessage(err),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (actionLoading) return;

    if (isLocationRequired && !geoCoords) {
      setFeedback({
        type: "error",
        message:
          "Chính sách yêu cầu tọa độ GPS. Vui lòng cấp quyền định vị trình duyệt.",
      });
      return;
    }

    if (isPhotoRequired && !photoSessionId) {
      setFeedback({
        type: "error",
        message:
          "Chính sách yêu cầu chụp ảnh bằng chứng. Vui lòng chụp hoặc tải ảnh.",
      });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);

      const record = await attendanceApi.checkOut({
        latitude: geoCoords?.latitude ?? null,
        longitude: geoCoords?.longitude ?? null,
        accuracyMeters: geoCoords?.accuracyMeters ?? null,
        photoUploadSessionId: photoSessionId ?? null,
        note: note.trim() || null,
      });

      setFeedback({
        type: "success",
        message: `Tan ca thành công lúc ${
          record.check_out_at
            ? new Date(record.check_out_at).toLocaleTimeString("vi-VN")
            : "bây giờ"
        }. Tổng thời gian: ${
          record.work_minutes
            ? (record.work_minutes / 60).toFixed(1) + " giờ"
            : "—"
        }.`,
      });

      setNote("");
      handleClearPhoto();
      await loadUserAndSummary();
      await loadHistory(currentPage);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: getAttendanceErrorMessage(err),
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
        badge={
          isLocationRequired
            ? "Vị trí GPS: Bắt buộc"
            : "Vị trí GPS: Không bắt buộc"
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
          value={
            isCompleted
              ? "Đã hoàn tất ca"
              : isCheckedIn
                ? "Đang trong ca"
                : "Chưa vào ca"
          }
          subtitle={
            summary?.today?.workMinutes
              ? `${(summary.today.workMinutes / 60).toFixed(1)} giờ làm việc`
              : summary?.today?.checkInAt
                ? `Vào lúc ${new Date(summary.today.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                : "Chưa điểm danh"
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
                Địa điểm chấm công:{" "}
                <span className="font-medium text-[#0F172A]">
                  Theo cấu hình quản trị viên hệ thống
                </span>
              </p>
            </div>

            {/* GPS Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#EDF2F7] self-start sm:self-auto">
              <MapPin
                className={`w-4 h-4 ${
                  geoCoords
                    ? "text-[#00D09C]"
                    : geoLoading
                      ? "text-amber-500 animate-spin"
                      : "text-[#94A3B8]"
                }`}
              />
              <span className="text-xs font-mono font-medium text-[#0F172A]">
                {geoCoords
                  ? `${geoCoords.latitude.toFixed(4)}, ${geoCoords.longitude.toFixed(4)}${
                      geoCoords.accuracyMeters
                        ? ` (±${Math.round(geoCoords.accuracyMeters)}m)`
                        : ""
                    }`
                  : geoLoading
                    ? "Đang tìm GPS..."
                    : geoError ||
                      (isLocationRequired ? "Chưa có GPS" : "GPS Tùy chọn")}
              </span>
              <button
                type="button"
                onClick={requestGeolocation}
                title="Lấy lại GPS"
                className="p-1 text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${geoLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* If location required and failed, show warning */}
          {isLocationRequired && !geoCoords && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Chính sách yêu cầu GPS. Vui lòng cho phép truy cập vị trí để
                  kích hoạt nút chấm công.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-7 text-xs border-amber-300"
                onClick={requestGeolocation}
              >
                Cấp lại quyền
              </Button>
            </div>
          )}

          {/* Photo Evidence Section (Rendered if policy.photoRequired is true) */}
          {isPhotoRequired && (
            <div className="space-y-2 border border-[#E2E8F0] p-4 rounded-xl bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#161827]" />
                  Ảnh bằng chứng chấm công (Bắt buộc)
                </label>
                {photoSessionId && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Check className="w-3.5 h-3.5" /> Đã xác thực ảnh
                  </span>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {!photoPreview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#CBD5E1] hover:border-[#161827] rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-xs text-[#64748B] hover:text-[#0F172A] transition-colors bg-white"
                >
                  <UploadCloud className="w-6 h-6 text-[#94A3B8]" />
                  <span className="font-semibold">
                    Chụp ảnh hoặc tải ảnh khuôn mặt
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">
                    Định dạng: JPG, PNG, WEBP (Tối đa 5 MB)
                  </span>
                </button>
              ) : (
                <div className="relative inline-block border border-[#CBD5E1] rounded-xl overflow-hidden bg-white">
                  <img
                    src={photoPreview}
                    alt="Bằng chứng chấm công"
                    className="w-36 h-36 object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                    title="Xóa ảnh"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {photoUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-semibold">
                      <RefreshCw className="w-4 h-4 animate-spin mr-1" /> Đang
                      tải...
                    </div>
                  )}
                </div>
              )}

              {photoError && (
                <p className="text-xs text-rose-600 font-medium">
                  {photoError}
                </p>
              )}
            </div>
          )}

          {/* Shift Completed Banner */}
          {isCompleted && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800 font-medium">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900">
                  Đã hoàn tất ca làm việc hôm nay!
                </p>
                <p className="text-emerald-700">
                  Bạn đã thực hiện đầy đủ lượt vào ca và tan ca cho ngày{" "}
                  {summary?.today?.checkInAt
                    ? new Date(summary.today.checkInAt).toLocaleDateString(
                        "vi-VN",
                      )
                    : "hôm nay"}
                  .
                </p>
              </div>
            </div>
          )}

          {/* Note Input */}
          {!isCompleted && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Ghi chú chấm công (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: Đi công tác tại cơ quan khách hàng, làm ngoài giờ..."
                value={note}
                disabled={actionLoading}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none focus:bg-white focus:border-[#E7AE18] transition-colors"
              />
            </div>
          )}

          {/* Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full h-14 text-sm font-bold tracking-wide"
              disabled={!canCheckIn}
              isLoading={actionLoading}
              onClick={handleCheckIn}
              leftIcon={<LogIn className="w-5 h-5" />}
            >
              VÀO CA (CHECK-IN)
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full h-14 text-sm font-bold tracking-wide hover:border-amber-500/40 hover:text-amber-600"
              disabled={!canCheckOut}
              isLoading={actionLoading}
              onClick={handleCheckOut}
              leftIcon={<LogOut className="w-5 h-5" />}
            >
              TAN CA (CHECK-OUT)
            </Button>
          </div>
        </Card>

        {/* Shift Policy Card (Dynamic according to server policy) */}
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#161827]">
            Quy định ca làm việc
          </h4>
          <div className="space-y-3 text-xs text-[#64748B]">
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Ca làm việc:</span>
              <span className="font-bold text-[#0F172A]">
                {policy?.workdayStartTime && policy?.workdayEndTime
                  ? `${policy.workdayStartTime.slice(0, 5)} — ${policy.workdayEndTime.slice(0, 5)}`
                  : "Linh hoạt / Theo ca"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Ân hạn đi muộn:</span>
              <span className="font-bold text-[#0F172A]">
                {policy?.lateGraceMinutes !== null &&
                policy?.lateGraceMinutes !== undefined
                  ? `${policy.lateGraceMinutes} phút`
                  : "0 phút"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Ân hạn về sớm:</span>
              <span className="font-bold text-[#0F172A]">
                {policy?.earlyLeaveGraceMinutes !== null &&
                policy?.earlyLeaveGraceMinutes !== undefined
                  ? `${policy.earlyLeaveGraceMinutes} phút`
                  : "0 phút"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EDF2F7]">
              <span>Chính sách GPS:</span>
              <span
                className={`font-bold ${
                  isLocationRequired ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {isLocationRequired ? "Bắt buộc vị trí" : "Không bắt buộc"}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Chính sách ảnh:</span>
              <span
                className={`font-bold ${
                  isPhotoRequired ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {isPhotoRequired ? "Bắt buộc chụp ảnh" : "Không yêu cầu"}
              </span>
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
            icon={<History className="w-8 h-8 text-[#161827]" />}
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
                  const isLate =
                    rec.status === "late" ||
                    rec.status === "late_and_early_leave";
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
                      <TableCell className="text-xs font-mono font-bold text-[#161827]">
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
          <div className="flex items-center justify-between pt-4 border-t border-[#EDF2F7] text-xs text-[#64748B]">
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
