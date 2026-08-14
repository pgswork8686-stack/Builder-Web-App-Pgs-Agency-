"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCw, Settings } from "lucide-react";
import {
  type NotificationItem,
  type NotificationPreferences,
  notificationsApi,
} from "@/lib/api/notifications";
import { NotificationBell } from "./notification-bell";

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

  return (
    <div className="min-h-screen bg-[#070707] text-[#FFF8E6]">
      <header className="sticky top-0 z-20 border-b border-[#151516] bg-[#0E0E0F]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#FFC400]">
              Phase 7
            </div>
            <h1 className="mt-1 text-2xl font-black text-white">
              Trung tâm thông báo
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Nhận tín hiệu từ task, bình luận, nghỉ phép, chấm công, tài chính,
              chat và thay đổi dự án.
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:p-8">
        <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F]">
          <div className="flex flex-col gap-3 border-b border-[#151516] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFC400] text-black">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Luồng thông báo của bạn
                </h2>
                <p className="text-xs text-[#606060]">
                  Dữ liệu được phân trang từ database, scope theo tài khoản hiện
                  tại.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setUnreadOnly((value) => !value);
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  unreadOnly
                    ? "border-[#FFC400] bg-[#FFC400] text-black"
                    : "border-[#FFC400]/20 text-[#FFC400]"
                }`}
              >
                Chỉ chưa đọc
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tải lại
              </button>
              <button
                type="button"
                disabled={saving === "all"}
                onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FFC400] px-3 py-2 text-xs font-black text-black disabled:opacity-50"
              >
                {saving === "all" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Đọc tất cả
              </button>
            </div>
          </div>

          {error ? (
            <div className="m-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#606060]">
              <Loader2 className="h-4 w-4 animate-spin text-[#FFC400]" />
              Đang tải thông báo...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-lg font-bold text-white">
                Không có thông báo phù hợp
              </div>
              <p className="mt-2 text-sm text-[#606060]">
                Khi có thay đổi liên quan đến bạn, thông báo sẽ xuất hiện tại
                đây.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#151516]">
              {items.map((item) => (
                <article key={item.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
                        item.readAt ? "bg-[#303033]" : "bg-[#FFC400]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-bold text-white">{item.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-[#FFF8E6]/75">
                            {item.message}
                          </p>
                        </div>
                        <div className="shrink-0 text-xs text-[#606060]">
                          {formatDateTime(item.createdAt)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#151516] px-3 py-1 text-[11px] font-semibold text-[#FFC400]">
                          {item.type}
                        </span>
                        {item.entityType ? (
                          <span className="rounded-full bg-[#151516] px-3 py-1 text-[11px] text-[#606060]">
                            {item.entityType}
                          </span>
                        ) : null}
                        <Link
                          href={safeActionUrl(item.actionUrl)}
                          onClick={() => void markRead(item)}
                          className="rounded-xl bg-[#FFC400] px-3 py-2 text-xs font-black text-black"
                        >
                          Mở liên kết
                        </Link>
                        {!item.readAt ? (
                          <button
                            type="button"
                            disabled={saving === item.id}
                            onClick={() => void markRead(item)}
                            className="rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-50"
                          >
                            {saving === item.id ? "Đang lưu..." : "Đã đọc"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[#151516] p-5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-30"
            >
              Trang trước
            </button>
            <div className="text-xs text-[#606060]">
              Trang {page}/{totalPages}
            </div>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-30"
            >
              Trang sau
            </button>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFC400]/10 text-[#FFC400]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">Tùy chọn nhận tin</h2>
                <p className="text-xs text-[#606060]">
                  Preferences nằm sau Nest, không ghi trực tiếp từ browser.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={!preferences || saving === "preferences"}
                onClick={toggleInApp}
                className="flex w-full items-center justify-between rounded-2xl border border-[#151516] p-4 text-left disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-bold text-white">
                    Thông báo trong app
                  </span>
                  <span className="text-xs text-[#606060]">
                    Áp dụng cho bell, center và realtime.
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    preferences?.inAppEnabled
                      ? "bg-emerald-400 text-black"
                      : "bg-[#151516] text-[#606060]"
                  }`}
                >
                  {preferences?.inAppEnabled ? "Bật" : "Tắt"}
                </span>
              </button>

              <button
                type="button"
                disabled={!preferences || saving === "preferences"}
                onClick={toggleEmail}
                className="flex w-full items-center justify-between rounded-2xl border border-[#151516] p-4 text-left disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-bold text-white">
                    Email notification
                  </span>
                  <span className="text-xs text-[#606060]">
                    Placeholder preference cho kênh email sau này.
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    preferences?.emailEnabled
                      ? "bg-emerald-400 text-black"
                      : "bg-[#151516] text-[#606060]"
                  }`}
                >
                  {preferences?.emailEnabled ? "Bật" : "Tắt"}
                </span>
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <h2 className="font-bold text-white">Đường dẫn nhanh</h2>
            <div className="mt-4 grid gap-2">
              <Link
                href="/app/chat"
                className="rounded-2xl border border-[#151516] p-4 text-sm font-semibold text-[#FFC400] hover:border-[#FFC400]/40"
              >
                Mở chat nội bộ / project
              </Link>
              <Link
                href="/app/projects"
                className="rounded-2xl border border-[#151516] p-4 text-sm font-semibold text-[#FFC400] hover:border-[#FFC400]/40"
              >
                Xem workspace dự án
              </Link>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
