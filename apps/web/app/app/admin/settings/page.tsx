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
import {
  fetchAllSettings,
  bulkUpdateSettings,
  SystemSetting,
} from "@/lib/api/settings";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
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

  const [radiusMeters, setRadiusMeters] = useState(150);
  const [allowRemote, setAllowRemote] = useState(true);
  const [workStartTime, setWorkStartTime] = useState("08:30");
  const [workEndTime, setWorkEndTime] = useState("17:30");

  const [sessionTimeout, setSessionTimeout] = useState(24);
  const [rateLimitRpm, setRateLimitRpm] = useState(120);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchAllSettings();
      setSettings(data);

      data.forEach((s) => {
        if (s.key === "company_info" && s.value) {
          setCompanyName(s.value.name || "PGS Agency Hub");
          setCompanyHotline(s.value.hotline || "1900 8686");
          setCompanyEmail(s.value.email || "contact@pgsagency.vn");
          setCompanyAddress(
            s.value.address ||
              "Tầng 2, DM 2-25, điểm TTCN làng nghề dệt lụa Vạn Phúc, Phường Hà Đông, Thành phố Hà Nội, Việt Nam",
          );
        } else if (s.key === "attendance_policy" && s.value) {
          setRadiusMeters(s.value.radius_meters || 150);
          setAllowRemote(Boolean(s.value.allow_remote));
          setWorkStartTime(s.value.work_start_time || "08:30");
          setWorkEndTime(s.value.work_end_time || "17:30");
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

      await bulkUpdateSettings([
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
          key: "attendance_policy",
          category: "attendance",
          value: {
            radius_meters: Number(radiusMeters),
            allow_remote: allowRemote,
            work_start_time: workStartTime,
            work_end_time: workEndTime,
          },
          description: "Quy định chấm công và geofencing",
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
                  Bán kính Geofence hợp lệ (Mét)
                </label>
                <input
                  type="number"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  min="50"
                  max="1000"
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

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="allowRemote"
                  checked={allowRemote}
                  onChange={(e) => setAllowRemote(e.target.checked)}
                  className="w-4 h-4 rounded border-[#CBD5E1] text-[#4F75FF] focus:ring-[#4F75FF]"
                />
                <label
                  htmlFor="allowRemote"
                  className="text-xs font-semibold text-[#334155] cursor-pointer"
                >
                  Cho phép làm việc từ xa (Work From Home) khi có phê duyệt
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
