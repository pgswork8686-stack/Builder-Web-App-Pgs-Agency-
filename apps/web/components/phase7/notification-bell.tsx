"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const realtimeLabel = useMemo(() => {
    const labels: Record<ConnectionState, string> = {
      connecting: "Đang kết nối realtime",
      connected: "Realtime đã kết nối",
      reconnecting: "Đang kết nối lại",
      denied: "Không có quyền realtime",
    };
    return labels[connectionState];
  }, [connectionState]);

  const reload = async () => {
    const [list, count] = await Promise.all([
      notificationsApi.list({ page: 1, pageSize: 6 }),
      notificationsApi.unreadCount(),
    ]);
    setItems(list.items);
    setUnreadCount(count.unreadCount);
  };

  useEffect(() => {
    let disposed = false;

    void reload()
      .catch(() => {
        if (!disposed) {
          setItems([]);
          setUnreadCount(0);
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

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
        setItems((current) =>
          [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, 6),
        );
        setUnreadCount((value) => value + 1);
      });
      socket.on("notifications:read", (notification: NotificationItem) => {
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? notification : item,
          ),
        );
        setUnreadCount((value) => Math.max(0, value - 1));
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
  }, []);

  const markRead = async (notification: NotificationItem) => {
    if (notification.readAt) return;
    setBusyId(notification.id);
    try {
      const updated = await notificationsApi.markRead(notification.id);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnreadCount((value) => Math.max(0, value - 1));
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
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#FFC400]/20 bg-[#151516] text-[#FFF8E6] transition hover:border-[#FFC400]/50 hover:text-[#FFC400]"
        aria-label="Mở thông báo"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#FFC400] px-1.5 py-0.5 text-[10px] font-black text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#FFC400]/20 bg-[#0E0E0F] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#151516] px-4 py-3">
            <div>
              <div className="text-sm font-bold text-white">Thông báo</div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[#606060]">
                {connectionState === "denied" ? (
                  <WifiOff className="h-3 w-3 text-red-400" />
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connectionState === "connected"
                        ? "bg-emerald-400"
                        : "bg-amber-400"
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
              className="inline-flex items-center gap-1 rounded-lg border border-[#FFC400]/20 px-2.5 py-1.5 text-[11px] font-semibold text-[#FFC400] disabled:cursor-not-allowed disabled:opacity-40"
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
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-[#606060]">
                <Loader2 className="h-4 w-4 animate-spin text-[#FFC400]" />
                Đang tải thông báo...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#606060]">
                Chưa có thông báo mới.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-[#151516] px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.readAt ? "bg-[#303033]" : "bg-[#FFC400]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-semibold text-white">
                        {item.title}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#FFF8E6]/70">
                        {item.message}
                      </p>
                      <div className="mt-2 text-[11px] text-[#606060]">
                        {formatDateTime(item.createdAt)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={safeActionUrl(item.actionUrl)}
                          onClick={() => void markRead(item)}
                          className="rounded-lg bg-[#FFC400] px-2.5 py-1.5 text-[11px] font-bold text-black"
                        >
                          Mở
                        </Link>
                        {!item.readAt ? (
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void markRead(item)}
                            className="rounded-lg border border-[#FFC400]/20 px-2.5 py-1.5 text-[11px] font-semibold text-[#FFC400] disabled:opacity-50"
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
            className="block border-t border-[#151516] px-4 py-3 text-center text-xs font-bold text-[#FFC400] hover:bg-[#151516]"
          >
            Xem trung tâm thông báo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
