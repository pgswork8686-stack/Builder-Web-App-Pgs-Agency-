"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  Loader2,
  RefreshCw,
  Settings,
  Megaphone,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  type NotificationItem,
  type NotificationPreferences,
  notificationsApi,
} from "@/lib/api/notifications";
import { getMe } from "@/lib/api/auth";
import { NotificationBell } from "./notification-bell";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";

function safeActionUrl(url: string | null) {
  if (!url || !url.startsWith("/app/")) return "/app/notifications";
  return url;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationsCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin broadcast states
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastType, setBroadcastType] = useState("announcement");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastActionUrl, setBroadcastActionUrl] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState<string | null>(
    null,
  );

  useEffect(() => {
    getMe()
      .then((res) => {
        if (res.account.role === "admin") {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, prefs] = await Promise.all([
        notificationsApi.list({ page, pageSize: 20, unreadOnly }),
        notificationsApi.getPreferences(),
      ]);
      setItems(list.items);
      setTotalPages(Math.max(1, list.totalPages));
      setPreferences(prefs);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tải được trung tâm thông báo.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (notification: NotificationItem) => {
    if (notification.readAt) return;
    setSaving(notification.id);
    try {
      const updated = await notificationsApi.markRead(notification.id);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đánh dấu đã đọc.");
    } finally {
      setSaving(null);
    }
  };

  const markAllRead = async () => {
    setSaving("all");
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không đánh dấu tất cả đã đọc.",
      );
    } finally {
      setSaving(null);
    }
  };

  const toggleInApp = async () => {
    if (!preferences) return;
    setSaving("preferences");
    try {
      const updated = await notificationsApi.updatePreferences({
        inAppEnabled: !preferences.inAppEnabled,
      });
      setPreferences(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được tùy chọn.");
    } finally {
      setSaving(null);
    }
  };

  const toggleEmail = async () => {
    if (!preferences) return;
    setSaving("preferences");
    try {
      const updated = await notificationsApi.updatePreferences({
        emailEnabled: !preferences.emailEnabled,
      });
      setPreferences(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được tùy chọn.");
    } finally {
      setSaving(null);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    try {
      setBroadcasting(true);
      setError(null);
      const res = await notificationsApi.broadcast({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: broadcastType,
        actionUrl: broadcastActionUrl.trim() || null,
      });

      setBroadcastSuccessMsg(
        res.message || "Đã phát thông báo toàn thể thành công!",
      );
      setTimeout(() => setBroadcastSuccessMsg(null), 5000);
      setIsBroadcastOpen(false);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastActionUrl("");
      setBroadcastType("announcement");
      await load();
    } catch (err: any) {
      setError(err?.message || "Không thể phát thông báo.");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Trung tâm thông báo"
        description="Nhận tín hiệu từ công việc, bình luận, nghỉ phép, chấm công, tài chính, chat và thay đổi dự án."
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBroadcastOpen(true)}
                leftIcon={<Megaphone className="h-3.5 w-3.5" />}
                className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-semibold"
              >
                Gửi thông báo toàn công ty
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Tải lại
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving === "all"}
              onClick={markAllRead}
              leftIcon={
                saving === "all" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )
              }
            >
              Đọc tất cả
            </Button>
          </div>
        }
      />

      {broadcastSuccessMsg && (
        <div className="p-4 rounded-2xl bg-[#E6FBF5] border border-[#A7F3D0] text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#00B788] shrink-0" />
            <span>{broadcastSuccessMsg}</span>
          </div>
          <button
            onClick={() => setBroadcastSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-6 space-y-4">
          <div className="flex flex-col gap-3 border-b border-[#EDF2F7] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F75FF]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A]">
                  Luồng thông báo của bạn
                </h2>
                <p className="text-xs text-[#64748B]">
                  Dữ liệu được phân trang từ database, scope theo tài khoản hiện
                  tại.
                </p>
              </div>
            </div>
            <div>
              <Button
                variant={unreadOnly ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setPage(1);
                  setUnreadOnly((value) => !value);
                }}
              >
                Chỉ chưa đọc
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-xs text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
              Đang tải thông báo...
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-8 h-8 text-[#4F75FF]" />}
              title="Không có thông báo phù hợp"
              description="Khi có thay đổi liên quan đến bạn, thông báo sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="divide-y divide-[#EDF2F7]">
              {items.map((item) => (
                <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.readAt ? "bg-[#CBD5E1]" : "bg-[#4F75FF]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-[#0F172A]">
                              {item.title}
                            </h3>
                            {item.metadata &&
                              (item.metadata as any).isBroadcast && (
                                <Badge variant="gold" size="sm">
                                  Toàn thể công ty
                                </Badge>
                              )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">
                            {item.message}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-[#94A3B8] font-mono">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="blue" size="sm">
                          {item.type}
                        </Badge>
                        {item.entityType ? (
                          <Badge variant="default" size="sm">
                            {item.entityType}
                          </Badge>
                        ) : null}
                        {item.actionUrl && (
                          <Link
                            href={safeActionUrl(item.actionUrl)}
                            onClick={() => void markRead(item)}
                          >
                            <Button variant="secondary" size="sm">
                              Mở liên kết
                            </Button>
                          </Link>
                        )}
                        {!item.readAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving === item.id}
                            onClick={() => void markRead(item)}
                            className="text-[#4F75FF]"
                          >
                            {saving === item.id ? "Đang lưu..." : "Đã đọc"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[#EDF2F7] pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Trang trước
            </Button>
            <span className="text-xs text-[#64748B]">
              Trang {page}/{totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </Button>
          </div>
        </Card>

        <aside className="space-y-6">
          {/* Admin Broadcast Card */}
          {isAdmin && (
            <Card className="p-6 space-y-3.5 border border-[#E0EAFF] bg-[#F8FAFF]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4F75FF] text-white">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#0F172A]">
                    Thông báo toàn thể nhân viên
                  </h3>
                  <p className="text-[10px] text-[#4F75FF] font-semibold">
                    Quyền hạn: Admin
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Gửi thông báo & tin tức quan trọng đến toàn bộ nhân sự đang hoạt
                động trong doanh nghiệp.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
                onClick={() => setIsBroadcastOpen(true)}
                leftIcon={<Megaphone className="h-3.5 w-3.5" />}
              >
                Gửi thông báo toàn thể
              </Button>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F75FF]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Tùy chọn nhận tin
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Preferences quản lý thông qua Nest API.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={!preferences || saving === "preferences"}
                onClick={toggleInApp}
                className="flex w-full items-center justify-between rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-3 text-left disabled:opacity-50 hover:bg-white transition-colors cursor-pointer"
              >
                <span>
                  <span className="block text-xs font-bold text-[#0F172A]">
                    Thông báo trong app
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Áp dụng cho bell, center và realtime.
                  </span>
                </span>
                <Badge
                  variant={preferences?.inAppEnabled ? "success" : "default"}
                  size="sm"
                >
                  {preferences?.inAppEnabled ? "Bật" : "Tắt"}
                </Badge>
              </button>

              <button
                type="button"
                disabled={!preferences || saving === "preferences"}
                onClick={toggleEmail}
                className="flex w-full items-center justify-between rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-3 text-left disabled:opacity-50 hover:bg-white transition-colors cursor-pointer"
              >
                <span>
                  <span className="block text-xs font-bold text-[#0F172A]">
                    Email notification
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Placeholder preference cho email.
                  </span>
                </span>
                <Badge
                  variant={preferences?.emailEnabled ? "success" : "default"}
                  size="sm"
                >
                  {preferences?.emailEnabled ? "Bật" : "Tắt"}
                </Badge>
              </button>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="font-bold text-[#0F172A] text-sm">
              Đường dẫn nhanh
            </h2>
            <div className="grid gap-2">
              <Link
                href="/app/chat"
                className="rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-3 text-xs font-bold text-[#4F75FF] hover:bg-[#EEF2FF] transition-colors"
              >
                Mở chat nội bộ / project
              </Link>
              <Link
                href="/app/projects"
                className="rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-3 text-xs font-bold text-[#4F75FF] hover:bg-[#EEF2FF] transition-colors"
              >
                Xem workspace dự án
              </Link>
            </div>
          </Card>
        </aside>
      </div>

      {/* DIALOG GỬI THÔNG BÁO TOÀN THỂ NHÂN VIÊN */}
      <Dialog
        isOpen={isBroadcastOpen}
        onClose={() => !broadcasting && setIsBroadcastOpen(false)}
        title={
          <div className="flex items-center gap-2.5 text-lg font-black text-[#0F172A]">
            <Megaphone className="w-5 h-5 text-[#4F75FF]" />
            Gửi thông báo đến toàn thể nhân viên
          </div>
        }
        description="Thông báo này sẽ được gửi realtime và lưu vào danh sách thông báo của tất cả nhân sự đang hoạt động trong agency."
        maxWidth="lg"
      >
        <form onSubmit={handleBroadcast} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Tiêu đề thông báo *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Thông báo nghỉ lễ Quốc Khánh / Họp toàn thể công ty"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Loại thông báo
              </label>
              <select
                value={broadcastType}
                onChange={(e) => setBroadcastType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
              >
                <option value="announcement">
                  Thông báo chung (Announcement)
                </option>
                <option value="urgent">Khẩn cấp (Urgent)</option>
                <option value="event">Sự kiện công ty (Company Event)</option>
                <option value="system">
                  Cập nhật hệ thống (System Update)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Đường dẫn liên kết (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: /app/admin/documents hoặc /app/calendar"
                value={broadcastActionUrl}
                onChange={(e) => setBroadcastActionUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nội dung thông báo chi tiết *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Nhập nội dung thông báo gửi đến toàn thể nhân viên..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] leading-relaxed focus:bg-white focus:border-[#4F75FF] outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EDF2F7]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={broadcasting}
              onClick={() => setIsBroadcastOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={broadcasting}
              leftIcon={<Send className="w-3.5 h-3.5" />}
              className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
            >
              Phát thông báo ngay
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
