"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar as CalendarIcon,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  workCalendarApi,
  type WorkCalendarEvent,
  type WorkCalendarSettings,
} from "@/lib/api/work-calendar";

export default function AdminWorkCalendarPage() {
  const [settings, setSettings] = useState<WorkCalendarSettings | null>(null);
  const [events, setEvents] = useState<WorkCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingHolidays, setSyncingHolidays] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Settings form states
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [alternateSaturdayEnabled, setAlternateSaturdayEnabled] =
    useState(true);
  const [alternateSaturdayAnchorDate, setAlternateSaturdayAnchorDate] =
    useState("2026-08-22");
  const [
    alternateSaturdayAnchorIsWorking,
    setAlternateSaturdayAnchorIsWorking,
  ] = useState(false);
  const [applyGovernmentMakeupDays, setApplyGovernmentMakeupDays] =
    useState(false);
  const [holidayCountryCode, setHolidayCountryCode] = useState("VN");
  const [holidayProvider, setHolidayProvider] = useState("calendarific");
  const [autoHolidaySyncEnabled, setAutoHolidaySyncEnabled] = useState(false);

  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    eventDate: "",
    eventType: "company_holiday" as WorkCalendarEvent["event_type"],
    title: "",
    isWorkingDay: false,
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [settingsData, eventsData] = await Promise.all([
        workCalendarApi.getSettings(),
        workCalendarApi.getEvents(),
      ]);

      if (settingsData) {
        setSettings(settingsData);
        setTimezone(settingsData.timezone || "Asia/Ho_Chi_Minh");
        setWorkingDays(settingsData.weekday_working_days || [1, 2, 3, 4, 5]);
        setAlternateSaturdayEnabled(settingsData.alternate_saturday_enabled);
        setAlternateSaturdayAnchorDate(
          settingsData.alternate_saturday_anchor_date || "2026-08-22",
        );
        setAlternateSaturdayAnchorIsWorking(
          settingsData.alternate_saturday_anchor_is_working,
        );
        setApplyGovernmentMakeupDays(settingsData.apply_government_makeup_days);
        setHolidayCountryCode(settingsData.holiday_country_code || "VN");
        setHolidayProvider(settingsData.holiday_provider || "calendarific");
        setAutoHolidaySyncEnabled(settingsData.auto_holiday_sync_enabled);
      }

      setEvents(eventsData || []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải cấu hình lịch làm việc.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSavedSuccess(false);

      const updated = await workCalendarApi.updateSettings({
        timezone,
        weekdayWorkingDays: workingDays,
        alternateSaturdayEnabled,
        alternateSaturdayAnchorDate,
        alternateSaturdayAnchorIsWorking,
        applyGovernmentMakeupDays,
        holidayCountryCode,
        holidayProvider,
        autoHolidaySyncEnabled,
      });

      setSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Không thể cập nhật cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncHolidays = async () => {
    try {
      setSyncingHolidays(true);
      setSyncResult(null);
      setError(null);

      const res = await workCalendarApi.syncHolidays(new Date().getFullYear());
      setSyncResult(
        `Đã đồng bộ thành công ${res.syncedCount} ngày lễ cho năm ${res.year} (${res.country}).`,
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Đồng bộ ngày lễ thất bại.");
    } finally {
      setSyncingHolidays(false);
    }
  };

  const openCreateEventModal = () => {
    setEditingEventId(null);
    setEventForm({
      eventDate: new Date().toISOString().substring(0, 10),
      eventType: "company_holiday",
      title: "",
      isWorkingDay: false,
      notes: "",
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event: WorkCalendarEvent) => {
    setEditingEventId(event.id);
    setEventForm({
      eventDate: event.event_date,
      eventType: event.event_type,
      title: event.title,
      isWorkingDay: event.is_working_day,
      notes: event.notes || "",
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingEventId) {
        await workCalendarApi.updateEvent(editingEventId, {
          eventDate: eventForm.eventDate,
          eventType: eventForm.eventType,
          title: eventForm.title,
          isWorkingDay: eventForm.isWorkingDay,
          notes: eventForm.notes || null,
        });
      } else {
        await workCalendarApi.createEvent({
          eventDate: eventForm.eventDate,
          eventType: eventForm.eventType,
          title: eventForm.title,
          isWorkingDay: eventForm.isWorkingDay,
          notes: eventForm.notes || null,
        });
      }
      setIsEventModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Lỗi lưu ngoại lệ lịch.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa ngoại lệ lịch này?")) return;
    try {
      await workCalendarApi.deleteEvent(eventId);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Không thể xóa sự kiện lịch.");
    }
  };

  const toggleDayOfWeek = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const dayLabels = [
    { day: 1, label: "T2" },
    { day: 2, label: "T3" },
    { day: 3, label: "T4" },
    { day: 4, label: "T5" },
    { day: 5, label: "T6" },
    { day: 6, label: "T7" },
    { day: 0, label: "CN" },
  ];

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      <SectionHeader
        title="Lịch Làm Việc Công Ty (Company Work Calendar)"
        description="Cấu hình ngày làm việc, thứ 7 cách tuần, ngày lễ và ngoại lệ lịch áp dụng toàn hệ thống."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {syncResult && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{syncResult}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Đã lưu cài đặt lịch làm việc thành công!</span>
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-xs text-[#64748B]">
          Đang tải dữ liệu cấu hình lịch làm việc...
        </Card>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Quy tắc chung */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-[#EDF2F7] pb-4">
              <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center font-bold">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Quy Tắc Tuần & Thứ 7 Cách Tuần
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Xác định các ngày làm việc tiêu chuẩn và chu kỳ 14 ngày làm
                  việc thứ 7.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Múi giờ hệ thống (Timezone)
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Các ngày làm việc trong tuần
                </label>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {dayLabels.map(({ day, label }) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(day)}
                        className={`w-9 h-8 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#4F75FF] text-white border-[#4F75FF]"
                            : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Thứ 7 cách tuần */}
            <div className="rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">
                    Áp dụng thứ 7 cách tuần (Alternate Saturday)
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Chu kỳ 14 ngày luân phiên 1 tuần nghỉ, 1 tuần làm việc.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alternateSaturdayEnabled}
                    onChange={(e) =>
                      setAlternateSaturdayEnabled(e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4F75FF]"></div>
                </label>
              </div>

              {alternateSaturdayEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F0]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Ngày mốc (Anchor Date)
                    </label>
                    <input
                      type="date"
                      value={alternateSaturdayAnchorDate}
                      onChange={(e) =>
                        setAlternateSaturdayAnchorDate(e.target.value)
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] outline-none focus:border-[#4F75FF]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Trạng thái ngày mốc
                    </label>
                    <select
                      value={
                        alternateSaturdayAnchorIsWorking ? "working" : "off"
                      }
                      onChange={(e) =>
                        setAlternateSaturdayAnchorIsWorking(
                          e.target.value === "working",
                        )
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] outline-none focus:border-[#4F75FF]"
                    >
                      <option value="off">Nghỉ thứ 7 (Anchor is OFF)</option>
                      <option value="working">
                        Đi làm thứ 7 (Anchor is WORKING)
                      </option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Hoán đổi lịch nhà nước */}
            <div className="flex items-center justify-between rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-4">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">
                  Tự động áp dụng lịch làm bù / hoán đổi của Nhà nước
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Mặc định TẮT. Chỉ bật khi công ty quyết định tuân thủ toàn bộ
                  lịch hoán đổi công chức.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyGovernmentMakeupDays}
                  onChange={(e) =>
                    setApplyGovernmentMakeupDays(e.target.checked)
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4F75FF]"></div>
              </label>
            </div>
          </Card>

          {/* Card 2: Holiday Sync */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Tự Động Đồng Bộ Ngày Lễ (Holiday API Sync)
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Tích hợp Calendarific API để tự động cập nhật ngày lễ Việt Nam
                  ({holidayCountryCode}).
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={syncingHolidays}
                onClick={handleSyncHolidays}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${syncingHolidays ? "animate-spin" : ""}`}
                />
                {syncingHolidays ? "Đang đồng bộ..." : "Đồng bộ ngay"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">
                  Nhà cung cấp
                </span>
                <span className="font-semibold text-[#0F172A]">
                  {holidayProvider || "Calendarific"}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">
                  Mã quốc gia
                </span>
                <span className="font-semibold text-[#0F172A]">
                  {holidayCountryCode}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-bold">
                  Lần đồng bộ gần nhất
                </span>
                <span className="font-semibold text-[#0F172A]">
                  {settings?.last_holiday_sync_at
                    ? new Date(settings.last_holiday_sync_at).toLocaleString(
                        "vi-VN",
                      )
                    : "Chưa đồng bộ"}
                </span>
              </div>
            </div>
          </Card>

          {/* Action button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              isLoading={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              Lưu cấu hình lịch
            </Button>
          </div>
        </form>
      )}

      {/* Card 3: Ngoại lệ lịch làm việc */}
      <Card className="p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Ngoại Lệ Lịch Làm Việc & Ngày Lễ
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Danh sách ngày nghỉ lễ, ngày làm bù, nghỉ nội bộ do Admin tạo hoặc
              đồng bộ từ API.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateEventModal}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Thêm ngoại lệ
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EDF2F7] text-[#64748B] font-bold bg-[#F8FAFC]">
                <th className="p-3">Ngày</th>
                <th className="p-3">Tên sự kiện / Ngày lễ</th>
                <th className="p-3">Loại</th>
                <th className="p-3">Trạng thái làm việc</th>
                <th className="p-3">Nguồn</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7]">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#94A3B8]">
                    Chưa có ngoại lệ lịch nào. Bấm &quot;Thêm ngoại lệ&quot; để tạo ngày
                    nghỉ/làm bù mới.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="p-3 font-mono font-bold text-[#0F172A]">
                      {ev.event_date}
                    </td>
                    <td className="p-3 font-semibold text-[#0F172A]">
                      {ev.title}
                      {ev.notes && (
                        <span className="block text-[11px] font-normal text-[#64748B]">
                          {ev.notes}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="p-3">
                      {ev.is_working_day ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                          Đi làm
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                          Nghỉ
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[11px] font-semibold ${
                          ev.source_type === "manual"
                            ? "text-[#4F75FF]"
                            : ev.source_type === "api"
                              ? "text-amber-600"
                              : "text-[#64748B]"
                        }`}
                      >
                        {ev.source_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEventModal(ev)}
                          className="p-1.5 text-[#64748B] hover:text-[#4F75FF] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer"
                          title="Sửa ngoại lệ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa ngoại lệ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Thêm / Sửa Ngoại lệ */}
      <Dialog
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        maxWidth="md"
        title={
          editingEventId
            ? "Sửa ngoại lệ lịch làm việc"
            : "Thêm ngoại lệ lịch làm việc"
        }
        description="Ngoại lệ thủ công (Manual) do Admin thiết lập luôn được ưu tiên cao nhất."
      >
        <form onSubmit={handleSaveEvent} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Ngày áp dụng *
            </label>
            <input
              type="date"
              required
              value={eventForm.eventDate}
              onChange={(e) =>
                setEventForm({ ...eventForm, eventDate: e.target.value })
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Tên ngoại lệ / lý do *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Đi làm bù dự án ra mắt, Nghỉ du lịch công ty"
              value={eventForm.title}
              onChange={(e) =>
                setEventForm({ ...eventForm, title: e.target.value })
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Phân loại
              </label>
              <select
                value={eventForm.eventType}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    eventType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
              >
                <option value="company_holiday">
                  Nghỉ nội bộ (company_holiday)
                </option>
                <option value="public_holiday">
                  Ngày lễ Quốc gia (public_holiday)
                </option>
                <option value="makeup_workday">
                  Đi làm bù (makeup_workday)
                </option>
                <option value="special_workday">
                  Ngày làm việc đặc biệt (special_workday)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Quy định đi làm
              </label>
              <select
                value={eventForm.isWorkingDay ? "true" : "false"}
                onChange={(e) =>
                  setEventForm({
                    ...eventForm,
                    isWorkingDay: e.target.value === "true",
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
              >
                <option value="false">
                  Nghỉ làm việc (is_working_day = false)
                </option>
                <option value="true">
                  Đi làm việc (is_working_day = true)
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Ghi chú thêm (tùy chọn)
            </label>
            <textarea
              rows={2}
              placeholder="Ghi chú chi tiết triển khai..."
              value={eventForm.notes}
              onChange={(e) =>
                setEventForm({ ...eventForm, notes: e.target.value })
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] outline-none focus:border-[#4F75FF]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEventModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              isLoading={saving}
            >
              Lưu ngoại lệ
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
