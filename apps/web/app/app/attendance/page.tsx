"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Camera,
  History,
  AlertCircle,
  CheckCircle,
  FileText,
  User2,
  Lock,
  Loader2,
} from "lucide-react";
import { getMe } from "@/lib/api/auth";
import {
  attendanceApi,
  AttendanceRecord,
  AttendanceSummary,
} from "@/lib/api/attendance";
import { createClient } from "@/lib/supabase/client";

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

  // Upload evidence states
  const [photoSessionId, setPhotoSessionId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

      // Attempt to fetch geolocation
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
  }, []);

  useEffect(() => {
    loadHistory(currentPage);
  }, [currentPage]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Frontend pre-validation (backend is authoritative)
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      setFeedback({
        type: "error",
        message: "Chỉ chấp nhận ảnh jpeg, png hoặc webp.",
      });
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setFeedback({
        type: "error",
        message: "Kích thước ảnh phải lớn hơn 0 và không vượt quá 5 MB.",
      });
      return;
    }

    try {
      setUploadingPhoto(true);
      setFeedback(null);

      // Generate upload signature from Nest API (sends fileSize for server-side binding)
      const sig = await attendanceApi.getPhotoUploadSignature(
        file.name,
        file.type,
        file.size,
      );
      setPhotoSessionId(sig.photoUploadSessionId);

      // Upload file directly using the pre-signed URL to private Supabase Storage
      const response = await fetch(sig.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Không thể tải tệp lên Storage Bucket.");
      }

      setPhotoPreview(URL.createObjectURL(file));
      setFeedback({
        type: "success",
        message: "Tải ảnh chứng minh chấm công thành công!",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Tải ảnh thất bại.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      setFeedback(null);

      await attendanceApi.checkIn({
        latitude: geoCoords?.latitude ?? null,
        longitude: geoCoords?.longitude ?? null,
        accuracyMeters: geoCoords ? 15 : null,
        photoUploadSessionId: photoSessionId,
        note: note,
      });

      setFeedback({
        type: "success",
        message: "Check-in chấm công hôm nay thành công!",
      });
      setNote("");
      setPhotoSessionId(null);
      setPhotoPreview(null);
      await loadUserAndSummary();
      await loadHistory(1);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gặp lỗi khi Check-in.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setFeedback(null);

      await attendanceApi.checkOut({
        latitude: geoCoords?.latitude ?? null,
        longitude: geoCoords?.longitude ?? null,
        accuracyMeters: geoCoords ? 15 : null,
        photoUploadSessionId: photoSessionId,
        note: note,
      });

      setFeedback({
        type: "success",
        message: "Check-out chấm công hôm nay thành công!",
      });
      setNote("");
      setPhotoSessionId(null);
      setPhotoPreview(null);
      await loadUserAndSummary();
      await loadHistory(1);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Gặp lỗi khi Check-out.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatVietnamTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "--:--";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-[#FFF8E6] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FFC400] animate-spin mb-4" />
        <span className="text-sm font-semibold tracking-wider text-[#606060]">
          Đang tải dữ liệu chấm công...
        </span>
      </div>
    );
  }

  const todayCheckedIn = summary?.today?.checkedIn || false;
  const todayCheckedOut = !!summary?.today?.checkOutAt;

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6] font-sans flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 lg:p-8 space-y-8">
        {/* Welcome Section */}
        <div className="border-b border-[#151516] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Chấm Công Hàng Ngày
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Thực hiện check-in đầu giờ, check-out cuối giờ và kiểm tra lịch sử
              công của bạn.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-[#151516] border border-[#FFC400]/20 rounded-2xl px-4 py-2 text-xs">
            <Clock className="w-4 h-4 text-[#FFC400]" />
            <span>Múi giờ chuẩn: Asia/Ho_Chi_Minh (Việt Nam)</span>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Check-In / Check-Out Interface Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC400]/5 rounded-bl-full pointer-events-none" />

              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FFC400]" />
                Khu vực thực hiện chấm công
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#151516] border border-[#FFC400]/10 text-center">
                  <span className="text-xs text-[#606060] uppercase font-semibold">
                    Giờ Check-in
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatVietnamTime(summary?.today?.checkInAt)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#151516] border border-[#FFC400]/10 text-center">
                  <span className="text-xs text-[#606060] uppercase font-semibold">
                    Giờ Check-out
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {formatVietnamTime(summary?.today?.checkOutAt)}
                  </div>
                </div>
              </div>

              {/* GPS and Location Status */}
              <div className="p-4 rounded-xl bg-[#151516] border border-[#151516] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#606060]">
                  <MapPin className="w-4 h-4 text-[#FFC400]" />
                  {geoCoords ? (
                    <span className="text-emerald-400">
                      Đã nhận được tọa độ GPS: {geoCoords.latitude.toFixed(4)},{" "}
                      {geoCoords.longitude.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-amber-500">
                      {geoError || "Đang lấy vị trí hiện tại..."}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Fields: Attachment Note + Photo Evidence */}
              {(!todayCheckedIn || !todayCheckedOut) && (
                <div className="space-y-4 pt-4 border-t border-[#151516]">
                  <div>
                    <label className="block text-xs font-semibold text-[#606060] uppercase mb-1">
                      Ghi chú (Tùy chọn)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Nhập ghi chú chấm công nếu có..."
                      className="w-full bg-[#151516] border border-[#FFC400]/10 rounded-xl px-4 py-3 text-sm text-[#FFF8E6] placeholder-[#606060] focus:outline-none focus:border-[#FFC400]/30 min-h-[80px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#606060] uppercase mb-2">
                      Ảnh chứng minh (Tải lên)
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#151516] border border-[#FFC400]/20 hover:bg-[#1f1f22] text-[#FFC400] text-xs font-bold transition-all cursor-pointer">
                        <Camera className="w-4 h-4" />
                        <span>Chụp/Chọn ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                      </label>
                      {uploadingPhoto && (
                        <Loader2 className="w-4 h-4 text-[#FFC400] animate-spin" />
                      )}
                      {photoPreview && (
                        <div
                          className="w-16 h-16 rounded-lg overflow-hidden border border-[#FFC400]/20 bg-cover bg-center"
                          style={{ backgroundImage: `url(${photoPreview})` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-4 border-t border-[#151516] flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCheckIn}
                  disabled={todayCheckedIn || actionLoading || uploadingPhoto}
                  className="flex-1 py-3.5 rounded-xl bg-[#FFC400] disabled:bg-[#151516] disabled:text-[#606060] disabled:border-transparent border border-transparent text-black font-extrabold text-sm transition-all shadow-[0_0_20px_rgba(255,196,0,0.1)] hover:brightness-105"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "CHECK-IN ĐẦU GIỜ"
                  )}
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={
                    !todayCheckedIn ||
                    todayCheckedOut ||
                    actionLoading ||
                    uploadingPhoto
                  }
                  className="flex-1 py-3.5 rounded-xl bg-[#151516] hover:bg-[#1f1f22] disabled:bg-[#151516]/50 disabled:text-[#606060] border border-[#FFC400]/30 disabled:border-transparent text-white font-extrabold text-sm transition-all"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "CHECK-OUT CUỐI GIỜ"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Side Panel Stats Summary */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FFC400]" />
                Tổng quan chấm công tháng
              </h2>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#151516] text-xs">
                  <span className="text-[#606060]">Số ngày có mặt</span>
                  <span className="font-bold text-emerald-400">
                    {summary?.monthly?.presentDays ?? 0} ngày
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#151516] text-xs">
                  <span className="text-[#606060]">Số ngày đi muộn</span>
                  <span className="font-bold text-amber-500">
                    {summary?.monthly?.lateCount ?? 0} ngày
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#151516] text-xs">
                  <span className="text-[#606060]">
                    Bản ghi chưa hoàn thành
                  </span>
                  <span className="font-bold text-rose-500">
                    {summary?.monthly?.incompleteCount ?? 0} ngày
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Log Section */}
        <div className="p-6 rounded-2xl bg-[#0E0E0F] border border-[#151516] space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#FFC400]" />
            Lịch sử chấm công gần đây
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#151516] text-[#606060]">
                  <th className="py-3 px-4 uppercase font-semibold">
                    Ngày chấm công
                  </th>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151516]/50">
                {historyLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#606060]">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FFC400]" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#606060]">
                      Chưa có dữ liệu chấm công lịch sử.
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-[#151516]/30 transition-colors"
                    >
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {historyTotal > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-[#151516] text-xs">
              <span className="text-[#606060]">
                Tổng số {historyTotal} bản ghi
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#151516] hover:bg-[#1f1f22] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  Trước
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={currentPage * pageSize >= historyTotal}
                  className="px-3 py-1.5 rounded-lg bg-[#151516] hover:bg-[#1f1f22] disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
