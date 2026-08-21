"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Shield,
  Bell,
  Globe,
  Save,
  RefreshCw,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchAllSettings, bulkUpdateSettings } from "@/lib/api/settings";
import { attendanceApi } from "@/lib/api/attendance";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState("PGS Agency Hub");
  const [companyHotline, setCompanyHotline] = useState("1900 8686");
  const [companyEmail, setCompanyEmail] = useState("contact@pgsagency.vn");
  const [companyAddress, setCompanyAddress] = useState(
    "Tầng 2, DM 2-25, điểm TTCN làng nghề dệt lụa Vạn Phúc, Phường Hà Đông, Thành phố Hà Nội, Việt Nam",
  );

  // These fields map directly to the canonical attendance_settings singleton.
  // Empty numeric/time fields intentionally remain unconfigured rather than
  // silently recreating obsolete policy defaults.
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [radiusMeters, setRadiusMeters] = useState("");
  const [officeLatitude, setOfficeLatitude] = useState("");
  const [officeLongitude, setOfficeLongitude] = useState("");
  const [locationRequired, setLocationRequired] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [workStartTime, setWorkStartTime] = useState("");
  const [workEndTime, setWorkEndTime] = useState("");
  const [lateGraceMinutes, setLateGraceMinutes] = useState("");
  const [earlyLeaveGraceMinutes, setEarlyLeaveGraceMinutes] = useState("");

  const [sessionTimeout, setSessionTimeout] = useState(24);
  const [rateLimitRpm, setRateLimitRpm] = useState(120);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [data, attendanceSettings] = await Promise.all([
        fetchAllSettings(),
        attendanceApi.getSettings(),
      ]);

      setTimezone(attendanceSettings.timezone);
      setRadiusMeters(
        attendanceSettings.location_radius_meters === null
          ? ""
          : String(attendanceSettings.location_radius_meters),
      );
      setOfficeLatitude(
        attendanceSettings.office_latitude === null
          ? ""
          : String(attendanceSettings.office_latitude),
      );
      setOfficeLongitude(
        attendanceSettings.office_longitude === null
          ? ""
          : String(attendanceSettings.office_longitude),
      );
      setLocationRequired(attendanceSettings.location_required);
      setPhotoRequired(attendanceSettings.photo_required);
      setWorkStartTime(
        attendanceSettings.workday_start_time?.slice(0, 5) ?? "",
      );
      setWorkEndTime(attendanceSettings.workday_end_time?.slice(0, 5) ?? "");
      setLateGraceMinutes(
        attendanceSettings.late_grace_minutes === null
          ? ""
          : String(attendanceSettings.late_grace_minutes),
      );
      setEarlyLeaveGraceMinutes(
        attendanceSettings.early_leave_grace_minutes === null
          ? ""
          : String(attendanceSettings.early_leave_grace_minutes),
      );

      data.forEach((s) => {
        if (s.key === "company_info" && s.value) {
          setCompanyName(s.value.name || "PGS Agency Hub");
          setCompanyHotline(s.value.hotline || "1900 8686");
          setCompanyEmail(s.value.email || "contact@pgsagency.vn");
          setCompanyAddress(
            s.value.address ||
              "Tầng 2, DM 2-25, điểm TTCN làng nghề dệt lụa Vạn Phúc, Phường Hà Đông, Thành phố Hà Nội, Việt Nam",
          );
        } else if (s.key === "security_policy" && s.value) {
          setSessionTimeout(s.value.session_timeout_hours || 24);
          setRateLimitRpm(s.value.rate_limit_rpm || 120);
        }
      });
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSavedSuccess(false);

      const optionalNumber = (value: string) =>
        value.trim() === "" ? null : Number(value);

      await Promise.all([
        bulkUpdateSettings([
          {
            key: "company_info",
            category: "general",
            value: {
              name: companyName,
              hotline: companyHotline,
              email: companyEmail,
              address: companyAddress,
            },
            description: "Thông tin liên hệ chung của công ty",
          },
          {
            key: "security_policy",
            category: "security",
            value: {
              session_timeout_hours: Number(sessionTimeout),
              rate_limit_rpm: Number(rateLimitRpm),
            },
            description: "Cấu hình chính sách bảo mật hệ thống",
          },
        ]),
        attendanceApi.updateSettings({
          timezone,
          workdayStartTime: workStartTime || null,
          workdayEndTime: workEndTime || null,
          lateGraceMinutes: optionalNumber(lateGraceMinutes),
          earlyLeaveGraceMinutes: optionalNumber(earlyLeaveGraceMinutes),
          locationRequired,
          photoRequired,
          locationRadiusMeters: optionalNumber(radiusMeters),
          officeLatitude: optionalNumber(officeLatitude),
          officeLongitude: optionalNumber(officeLongitude),
        }),
      ]);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Cài đặt Hệ thống (System Settings)"
        description="Cấu hình thông số tổ chức, bảo mật phiên làm việc và tùy chọn thông báo toàn agency."
        badge="Đã kết nối cơ sở dữ liệu"
        badgeVariant="success"
        action={
          <Button
            variant="primary"
            size="sm"
            disabled={saving}
            leftIcon={
              savedSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
            onClick={handleSave}
          >
            {saving
              ? "Đang lưu..."
              : savedSuccess
                ? "Đã lưu thành công!"
                : "Lưu cấu hình"}
          </Button>
        }
      />

      {loading ? (
        <div className="p-12 text-center text-[#7C879D]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Đang tải thông số cấu hình...
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Work Calendar Link Card */}
          <Card className="p-6 space-y-4 border border-[#4F75FF]/30 bg-[#EEF2FF]/40 shadow-xs md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4F75FF] text-white flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">
                    Lịch Làm Việc Công Ty & Đồng Bộ Ngày Lễ
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Cấu hình thứ 7 cách tuần, ngày lễ quốc gia, ngày làm bù và
                    ngoại lệ lịch áp dụng toàn hệ thống.
                  </p>
                </div>
              </div>
              <a
                href="/app/admin/settings/work-calendar"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-[#4F75FF] hover:bg-[#3D61E6] rounded-xl transition-colors shrink-0 shadow-xs"
              >
                Quản lý lịch làm việc →
              </a>
            </div>
          </Card>

          {/* Company Info */}
          <Card className="p-6 space-y-4 border border-[#EDF2F7] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Thông tin Tổ chức
                </h4>
                <p className="text-xs text-[#64748B]">
                  Tên và thông tin nhận diện doanh nghiệp
                </p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-bold text-[#334155] block mb-1.5">
                  Tên tổ chức / Agency
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Hotline
                  </label>
                  <input
                    type="text"
                    value={companyHotline}
                    onChange={(e) => setCompanyHotline(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Email CSKH
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#334155] block mb-1.5">
                  Địa chỉ trụ sở
                </label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                />
              </div>
            </div>
          </Card>

          {/* Attendance Policy */}
          <Card className="p-6 space-y-4 border border-[#EDF2F7] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF9C3] text-[#A16207] flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Quy chuẩn Chấm công & Ca làm việc
                </h4>
                <p className="text-xs text-[#64748B]">
                  Cấu hình bán kính định vị GPS và khung giờ chuẩn
                </p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-bold text-[#334155] block mb-1.5">
                  Múi giờ chấm công
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  aria-label="Múi giờ chấm công"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Giờ vào ca (Sáng)
                  </label>
                  <input
                    type="time"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Giờ tan ca (Chiều)
                  </label>
                  <input
                    type="time"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Dung sai đi muộn (phút)
                  </label>
                  <input
                    type="number"
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(e.target.value)}
                    min="0"
                    max="1440"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Dung sai về sớm (phút)
                  </label>
                  <input
                    type="number"
                    value={earlyLeaveGraceMinutes}
                    onChange={(e) => setEarlyLeaveGraceMinutes(e.target.value)}
                    min="0"
                    max="1440"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Bán kính Geofence (mét)
                  </label>
                  <input
                    type="number"
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(e.target.value)}
                    min="1"
                    max="100000"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Vĩ độ văn phòng
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={officeLatitude}
                    onChange={(e) => setOfficeLatitude(e.target.value)}
                    min="-90"
                    max="90"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#334155] block mb-1.5">
                    Kinh độ văn phòng
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={officeLongitude}
                    onChange={(e) => setOfficeLongitude(e.target.value)}
                    min="-180"
                    max="180"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationRequired}
                    onChange={(e) => setLocationRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#4F75FF] focus:ring-[#4F75FF]"
                  />
                  Bắt buộc GPS khi chấm công
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoRequired}
                    onChange={(e) => setPhotoRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#4F75FF] focus:ring-[#4F75FF]"
                  />
                  Bắt buộc ảnh bằng chứng khi chấm công
                </label>
              </div>
            </div>
          </Card>

          {/* Security & Rate Limiting */}
          <Card className="p-6 space-y-4 border border-[#EDF2F7] shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6FBF5] text-[#00B788] flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Bảo mật & Phiên làm việc
                </h4>
                <p className="text-xs text-[#64748B]">
                  Chính sách hết hạn phiên và giới hạn yêu cầu (Throttling)
                </p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-bold text-[#334155] block mb-1.5">
                  Thời gian hết hạn phiên (Giờ)
                </label>
                <input
                  type="number"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  min="1"
                  max="168"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#334155] block mb-1.5">
                  Giới hạn yêu cầu API (Req / Phút)
                </label>
                <input
                  type="number"
                  value={rateLimitRpm}
                  onChange={(e) => setRateLimitRpm(Number(e.target.value))}
                  min="30"
                  max="1000"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-[#EDF2F7] bg-[#F6F8FC] text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
                />
              </div>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
