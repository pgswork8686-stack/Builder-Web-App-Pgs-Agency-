"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, WifiOff } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";
import {
  type NotificationItem,
  notificationsApi,
} from "@/lib/api/notifications";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "denied";

function safeActionUrl(url: string | null) {
  if (!url || !url.startsWith("/app/")) return "/app/notifications";
  return url;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const socketRef = useRef<Socket | null>(null);
  const receivedNotificationIds = useRef(new Set<string>());
  const handledReadIds = useRef(new Set<string>());

  const realtimeLabel = useMemo(() => {
    const labels: Record<ConnectionState, string> = {
      connecting: "Đang kết nối realtime",
      connected: "Realtime đã kết nối",
      reconnecting: "Đang kết nối lại",
      denied: "Không có quyền realtime",
    };
    return labels[connectionState];
  }, [connectionState]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list({ page: 1, pageSize: 6 }),
        notificationsApi.unreadCount(),
      ]);
      list.items.forEach((item) =>
        receivedNotificationIds.current.add(item.id),
      );
      setItems(list.items);
      setUnreadCount(count.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
      setError("Không thể tải thông báo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyRead = useCallback((notification: NotificationItem) => {
    if (handledReadIds.current.has(notification.id)) return;

    handledReadIds.current.add(notification.id);
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id ? notification : item,
      ),
    );
    setUnreadCount((value) => Math.max(0, value - 1));
  }, []);

  useEffect(() => {
    let disposed = false;

    void reload();

    void getAccessToken().then((token) => {
      if (disposed || !token) {
        setConnectionState("denied");
        return;
      }

      const apiUrl = new URL(API_BASE_URL, window.location.origin);
      const socket = io(`${apiUrl.origin}/notifications`, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => setConnectionState("connected"));
      socket.on("disconnect", () => setConnectionState("reconnecting"));
      socket.on("connect_error", () => setConnectionState("reconnecting"));
      socket.on("notifications:new", (notification: NotificationItem) => {
        if (receivedNotificationIds.current.has(notification.id)) return;

        receivedNotificationIds.current.add(notification.id);
        setItems((current) =>
          [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, 6),
        );
        setUnreadCount((value) => value + 1);
      });
      socket.on("notifications:read", (notification: NotificationItem) => {
        applyRead(notification);
      });
      socket.on("notifications:read-all", () => {
        setItems((current) =>
          current.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
      });
    });

    return () => {
      disposed = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [applyRead, reload]);

  const markRead = async (notification: NotificationItem) => {
    if (notification.readAt) return;
    setBusyId(notification.id);
    try {
      const updated = await notificationsApi.markRead(notification.id);
      applyRead(updated);
    } catch {
      setError("Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setBusyId("all");
    try {
      await notificationsApi.markAllRead();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      setError("Không thể đánh dấu tất cả thông báo đã đọc. Vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#EDF2F7] bg-white text-[#64748B] transition hover:border-[#4F75FF]/30 hover:text-[#4F75FF] hover:bg-[#F8FAFC] shadow-2xs"
        aria-label="Mở thông báo"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#4F75FF] px-1.5 py-0.5 text-[10px] font-black text-white shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#EDF2F7] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#EDF2F7] px-4 py-3 bg-[#F8FAFC]">
            <div>
              <div className="text-sm font-bold text-[#0F172A]">Thông báo</div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                {connectionState === "denied" ? (
                  <WifiOff className="h-3 w-3 text-red-500" />
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connectionState === "connected"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                  />
                )}
                {realtimeLabel}
              </div>
            </div>
            <button
              type="button"
              disabled={busyId === "all" || unreadCount === 0}
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-lg border border-[#EDF2F7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4F75FF] hover:bg-[#EEF2FF] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              {busyId === "all" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Đọc hết
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <div
                role="alert"
                className="px-4 py-6 text-center text-xs text-rose-600 bg-rose-50"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-3 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
                Đang tải thông báo...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#94A3B8]">
                Chưa có thông báo mới.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-[#EDF2F7] px-4 py-3 last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        item.readAt ? "bg-[#CBD5E1]" : "bg-[#4F75FF]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-xs font-bold text-[#0F172A]">
                        {item.title}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#64748B]">
                        {item.message}
                      </p>
                      <div className="mt-2 text-[10px] font-mono text-[#94A3B8]">
                        {formatDateTime(item.createdAt)}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Link
                          href={safeActionUrl(item.actionUrl)}
                          onClick={() => void markRead(item)}
                          className="rounded-lg bg-[#4F75FF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#3D62EE] transition-colors"
                        >
                          Mở
                        </Link>
                        {!item.readAt ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void markRead(item)}
                            className="rounded-lg border border-[#EDF2F7] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors"
                          >
                            {busyId === item.id ? "Đang lưu..." : "Đã đọc"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/app/notifications"
            className="block border-t border-[#EDF2F7] bg-[#F8FAFC] px-4 py-2.5 text-center text-xs font-bold text-[#4F75FF] hover:bg-[#EEF2FF] transition-colors"
          >
            Xem trung tâm thông báo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
