"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FolderOpen,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { getMe, type AccountPayload } from "@/lib/api/auth";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";
import {
  chatApi,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/api/chat";
import { NotificationBell } from "./notification-bell";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "denied";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function conversationTitle(conversation: ChatConversation) {
  if (conversation.type === "project") {
    return conversation.project?.name ?? conversation.title ?? "Project chat";
  }
  return conversation.title ?? "Direct chat";
}

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const selectedRef = useRef<string | null>(null);
  const initialHandledRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  const isClient = account?.role === "client";

  const connectionLabel = useMemo(() => {
    const labels: Record<ConnectionState, string> = {
      connecting: "Đang kết nối chat realtime",
      connected: "Realtime chat đã kết nối",
      reconnecting: "Đang kết nối lại — khi quay lại sẽ tải mới",
      denied: "Không có quyền realtime",
    };
    return labels[connectionState];
  }, [connectionState]);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await chatApi.listConversations({ page: 1, pageSize: 50 });
      setConversations(list.items);
      return list.items;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được danh sách chat.",
      );
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  const joinRealtimeRoom = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit(
      "chat.join",
      { conversationId },
      (response: { ok?: boolean; error?: string }) => {
        if (!response?.ok) {
          setConnectionState("denied");
          setError("Bạn không có quyền tham gia phòng chat này.");
        }
      },
    );
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, before?: string | null) => {
      setLoadingMessages(true);
      setError(null);
      try {
        const result = await chatApi.listMessages(conversationId, {
          limit: 50,
          before: before ?? undefined,
        });
        setMessages((current) =>
          before ? [...result.items, ...current] : result.items,
        );
        setNextBefore(result.nextBefore);
        await chatApi.markRead(conversationId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được tin nhắn.",
        );
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  const openConversation = useCallback(
    async (conversation: ChatConversation) => {
      selectedRef.current = conversation.id;
      setSelected(conversation);
      setMessages([]);
      setNextBefore(null);
      joinRealtimeRoom(conversation.id);
      await loadMessages(conversation.id);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id
            ? { ...item, hasUnread: false, readAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [joinRealtimeRoom, loadMessages],
  );

  const fetchConversationAndOpen = useCallback(
    async (conversationId: string) => {
      setWorking(conversationId);
      try {
        const conversation = await chatApi.getConversation(conversationId);
        setConversations((current) => {
          if (current.some((item) => item.id === conversation.id)) {
            return current;
          }
          return [conversation, ...current];
        });
        await openConversation(conversation);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không mở được cuộc trò chuyện.",
        );
      } finally {
        setWorking(null);
      }
    },
    [openConversation],
  );

  useEffect(() => {
    let disposed = false;

    void Promise.all([getMe(), loadConversations()]).then(([me, list]) => {
      if (disposed) return;
      setAccount(me.account);

      if (initialHandledRef.current) return;
      initialHandledRef.current = true;

      const conversationId = searchParams.get("conversationId");
      const initialProjectId = searchParams.get("projectId");
      if (conversationId) {
        void fetchConversationAndOpen(conversationId);
        return;
      }
      if (initialProjectId) {
        setProjectId(initialProjectId);
        void chatApi
          .getProjectConversation(initialProjectId)
          .then((conversation) => openConversation(conversation))
          .then(loadConversations)
          .catch((err) =>
            setError(
              err instanceof Error
                ? err.message
                : "Không mở được project chat.",
            ),
          );
        return;
      }
      if (list[0]) {
        void openConversation(list[0]);
      }
    });

    return () => {
      disposed = true;
    };
  }, [
    fetchConversationAndOpen,
    loadConversations,
    openConversation,
    searchParams,
  ]);

  useEffect(() => {
    let disposed = false;

    void getAccessToken().then((token) => {
      if (disposed || !token) {
        setConnectionState("denied");
        return;
      }
      const apiUrl = new URL(API_BASE_URL, window.location.origin);
      const socket = io(`${apiUrl.origin}/chat`, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnectionState("connected");
        if (selectedRef.current) joinRealtimeRoom(selectedRef.current);
      });
      socket.on("disconnect", () => setConnectionState("reconnecting"));
      socket.on("connect_error", () => setConnectionState("reconnecting"));
      socket.on("chat.error", () => setConnectionState("denied"));
      socket.on("chat:message:new", (message: ChatMessage) => {
        setConversations((current) =>
          current.map((item) =>
            item.id === message.conversationId
              ? {
                  ...item,
                  hasUnread: item.id !== selectedRef.current,
                  lastMessageAt: message.createdAt,
                }
              : item,
          ),
        );
        if (message.conversationId !== selectedRef.current) return;
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message],
        );
        void chatApi.markRead(message.conversationId);
      });
    });

    return () => {
      disposed = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [joinRealtimeRoom]);

  const createDirect = async () => {
    if (!peerUserId.trim()) return;
    setWorking("direct");
    setError(null);
    try {
      const conversation = await chatApi.createDirect(peerUserId.trim());
      await loadConversations();
      await openConversation(conversation);
      setPeerUserId("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tạo được direct chat. Hãy kiểm tra user id.",
      );
    } finally {
      setWorking(null);
    }
  };

  const openProjectChat = async () => {
    if (!projectId.trim()) return;
    setWorking("project");
    setError(null);
    try {
      const conversation = await chatApi.getProjectConversation(
        projectId.trim(),
      );
      await loadConversations();
      await openConversation(conversation);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không mở được project chat. Server sẽ kiểm tra membership.",
      );
    } finally {
      setWorking(null);
    }
  };

  const sendMessage = async () => {
    const content = draft.trim();
    if (!selected || !content || content.length > 4000) return;
    setSending(true);
    setError(null);
    try {
      const message = await chatApi.sendMessage(selected.id, content);
      setDraft("");
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
      setConversations((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, lastMessageAt: message.createdAt, hasUnread: false }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn.");
    } finally {
      setSending(false);
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
              Chat nội bộ & project
            </h1>
            <p className="mt-1 text-sm text-[#606060]">
              Direct chat chỉ dành cho nội bộ. Client chỉ tham gia project chat
              đã được server xác thực.
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[22rem_1fr] lg:p-8">
        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-white">Cuộc trò chuyện</h2>
                <p className="mt-1 text-xs text-[#606060]">
                  Danh sách theo membership hiện tại.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadConversations()}
                className="rounded-xl border border-[#FFC400]/20 p-2 text-[#FFC400]"
                aria-label="Tải lại chat"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-[#606060]">
              {connectionState === "denied" ? (
                <WifiOff className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionState === "connected"
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
              )}
              {connectionLabel}
            </div>

            <div className="mt-5 max-h-[32rem] space-y-2 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#606060]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FFC400]" />
                  Đang tải...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-2xl border border-[#151516] p-5 text-center text-sm text-[#606060]">
                  Chưa có cuộc trò chuyện nào. Hãy mở project chat hoặc direct
                  chat hợp lệ.
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void openConversation(conversation)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected?.id === conversation.id
                        ? "border-[#FFC400] bg-[#FFC400]/10"
                        : "border-[#151516] hover:border-[#FFC400]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {conversationTitle(conversation)}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-[#606060]">
                          {conversation.type === "project"
                            ? "Project chat"
                            : "Direct chat"}
                        </div>
                      </div>
                      {conversation.hasUnread ? (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FFC400]" />
                      ) : null}
                    </div>
                    {conversation.lastMessageAt ? (
                      <div className="mt-3 text-[11px] text-[#606060]">
                        {formatDateTime(conversation.lastMessageAt)}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-[#FFC400]" />
              <h2 className="font-bold text-white">Mở direct chat</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#606060]">
              Direct chat chỉ cho admin, team leader, employee, accountant với
              user nội bộ đang active. Client bị chặn ở cả UI và server.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={peerUserId}
                disabled={isClient}
                onChange={(event) => setPeerUserId(event.target.value)}
                placeholder="Peer user UUID"
                className="w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
              />
              <button
                type="button"
                disabled={
                  isClient || working === "direct" || !peerUserId.trim()
                }
                onClick={createDirect}
                className="w-full rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === "direct" ? "Đang mở..." : "Mở direct chat"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#151516] bg-[#0E0E0F] p-5">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-[#FFC400]" />
              <h2 className="font-bold text-white">Mở project chat</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#606060]">
              Server kiểm tra project membership/client company trước khi tạo
              hoặc join phòng.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                placeholder="Project UUID"
                className="w-full rounded-xl border border-[#151516] bg-[#070707] px-3 py-2 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
              />
              <button
                type="button"
                disabled={working === "project" || !projectId.trim()}
                onClick={openProjectChat}
                className="w-full rounded-xl bg-[#FFC400] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === "project" ? "Đang mở..." : "Mở project chat"}
              </button>
            </div>
          </section>
        </aside>

        <section className="flex min-h-[42rem] flex-col rounded-3xl border border-[#151516] bg-[#0E0E0F]">
          <div className="flex items-center justify-between gap-4 border-b border-[#151516] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFC400] text-black">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white">
                  {selected ? conversationTitle(selected) : "Chưa chọn chat"}
                </h2>
                <p className="text-xs text-[#606060]">
                  {selected
                    ? `${selected.type === "project" ? "Project chat" : "Direct chat"} · ${selected.id}`
                    : "Chọn một cuộc trò chuyện ở cột trái."}
                </p>
              </div>
            </div>
            {selected ? (
              <button
                type="button"
                disabled={loadingMessages}
                onClick={() => void loadMessages(selected.id)}
                className="rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-50"
              >
                Tải lại
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="m-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-5">
            {!selected ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-[#606060]">
                Chọn hoặc mở một cuộc trò chuyện để bắt đầu.
              </div>
            ) : loadingMessages && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-[#606060]">
                <Loader2 className="h-4 w-4 animate-spin text-[#FFC400]" />
                Đang tải lịch sử chat...
              </div>
            ) : (
              <div className="space-y-4">
                {nextBefore ? (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled={loadingMessages}
                      onClick={() =>
                        selected && void loadMessages(selected.id, nextBefore)
                      }
                      className="rounded-xl border border-[#FFC400]/20 px-3 py-2 text-xs font-bold text-[#FFC400] disabled:opacity-50"
                    >
                      Tải tin cũ hơn
                    </button>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-[#151516] p-8 text-center text-sm text-[#606060]">
                    Chưa có tin nhắn. Tin nhắn chỉ hỗ trợ plain text, tối đa
                    4000 ký tự.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMe =
                      message.senderUserId === selected.currentUserId;
                    return (
                      <article
                        key={message.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
                            isMe
                              ? "border-[#FFC400]/40 bg-[#FFC400] text-black"
                              : "border-[#151516] bg-[#070707] text-[#FFF8E6]"
                          }`}
                        >
                          <div
                            className={`text-[11px] font-bold ${
                              isMe ? "text-black/60" : "text-[#FFC400]"
                            }`}
                          >
                            {message.sender?.full_name ??
                              message.sender?.email ??
                              (isMe ? "Bạn" : "Thành viên")}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                            {message.content}
                          </p>
                          <div
                            className={`mt-2 text-[11px] ${
                              isMe ? "text-black/55" : "text-[#606060]"
                            }`}
                          >
                            {formatDateTime(message.createdAt)}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <form
            className="border-t border-[#151516] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={draft}
                disabled={!selected || sending}
                onChange={(event) =>
                  setDraft(event.target.value.slice(0, 4000))
                }
                placeholder={
                  selected
                    ? "Nhập tin nhắn plain text..."
                    : "Chọn cuộc trò chuyện trước"
                }
                className="min-h-20 flex-1 resize-none rounded-2xl border border-[#151516] bg-[#070707] px-4 py-3 text-sm text-white outline-none placeholder:text-[#606060] focus:border-[#FFC400]"
              />
              <button
                type="submit"
                disabled={!selected || sending || !draft.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFC400] px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Gửi
              </button>
            </div>
            <div className="mt-2 text-right text-[11px] text-[#606060]">
              {draft.length}/4000
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
