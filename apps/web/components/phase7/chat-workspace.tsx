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
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-6">
      <SectionHeader
        title="Chat nội bộ & Dự án"
        description="Direct chat dành cho nhân sự nội bộ. Client tham gia project chat theo quyền truy cập được cấp."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadConversations()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Tải lại
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Cuộc trò chuyện
                </h2>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Danh sách theo quyền truy cập của bạn.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              {connectionState === "denied" ? (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionState === "connected"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }`}
                />
              )}
              {connectionLabel}
            </div>

            <div className="max-h-[32rem] space-y-2 overflow-y-auto pt-2">
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
                  Đang tải...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] p-5 text-center text-xs text-[#94A3B8]">
                  Chưa có cuộc trò chuyện nào.
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void openConversation(conversation)}
                    className={`w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      selected?.id === conversation.id
                        ? "border-[#4F75FF] bg-[#EEF2FF]"
                        : "border-[#EDF2F7] bg-white hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[#0F172A]">
                          {conversationTitle(conversation)}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[#64748B]">
                          {conversation.type === "project"
                            ? "Project chat"
                            : "Direct chat"}
                        </div>
                      </div>
                      {conversation.hasUnread ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#4F75FF]" />
                      ) : null}
                    </div>
                    {conversation.lastMessageAt ? (
                      <div className="mt-2 text-[10px] text-[#94A3B8] font-mono">
                        {formatDateTime(conversation.lastMessageAt)}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <UserPlus className="h-4 w-4 text-[#4F75FF]" />
              <h2 className="font-bold text-[#0F172A] text-sm">
                Mở direct chat
              </h2>
            </div>
            <p className="text-xs text-[#64748B]">
              Direct chat chỉ dành cho nhân sự nội bộ (Admin, Leader, Employee,
              Accountant).
            </p>
            <div className="space-y-2 pt-1">
              <input
                value={peerUserId}
                disabled={isClient}
                onChange={(event) => setPeerUserId(event.target.value)}
                placeholder="Nhập User UUID..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                disabled={
                  isClient || working === "direct" || !peerUserId.trim()
                }
                onClick={createDirect}
              >
                {working === "direct" ? "Đang mở..." : "Mở direct chat"}
              </Button>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <FolderOpen className="h-4 w-4 text-[#4F75FF]" />
              <h2 className="font-bold text-[#0F172A] text-sm">
                Mở project chat
              </h2>
            </div>
            <p className="text-xs text-[#64748B]">
              Hệ thống xác thực quyền tham gia dự án trước khi mở phòng chat.
            </p>
            <div className="space-y-2 pt-1">
              <input
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                placeholder="Nhập Project UUID..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF]"
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                disabled={working === "project" || !projectId.trim()}
                onClick={openProjectChat}
              >
                {working === "project" ? "Đang mở..." : "Mở project chat"}
              </Button>
            </div>
          </Card>
        </aside>

        <Card className="flex min-h-[42rem] flex-col p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#EDF2F7] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F75FF]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">
                  {selected
                    ? conversationTitle(selected)
                    : "Chưa chọn cuộc trò chuyện"}
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  {selected
                    ? `${selected.type === "project" ? "Project chat" : "Direct chat"} · ${selected.id}`
                    : "Chọn một cuộc trò chuyện ở cột trái."}
                </p>
              </div>
            </div>
            {selected ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={loadingMessages}
                onClick={() => void loadMessages(selected.id)}
              >
                Tải lại
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!selected ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-[#94A3B8]">
                Chọn hoặc mở một cuộc trò chuyện để bắt đầu.
              </div>
            ) : loadingMessages && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
                Đang tải lịch sử chat...
              </div>
            ) : (
              <div className="space-y-3">
                {nextBefore ? (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingMessages}
                      onClick={() =>
                        selected && void loadMessages(selected.id, nextBefore)
                      }
                    >
                      Tải tin cũ hơn
                    </Button>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] p-8 text-center text-xs text-[#94A3B8]">
                    Chưa có tin nhắn. Tin nhắn hỗ trợ plain text, tối đa 4000 ký
                    tự.
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
                          className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs ${
                            isMe
                              ? "bg-[#4F75FF] text-white"
                              : "bg-[#F1F5F9] text-[#0F172A]"
                          }`}
                        >
                          <div
                            className={`text-[10px] font-bold ${
                              isMe ? "text-white/80" : "text-[#4F75FF]"
                            }`}
                          >
                            {message.sender?.full_name ??
                              message.sender?.email ??
                              (isMe ? "Bạn" : "Thành viên")}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">
                            {message.content}
                          </p>
                          <div
                            className={`mt-1.5 text-[9px] font-mono text-right ${
                              isMe ? "text-white/70" : "text-[#94A3B8]"
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
            className="border-t border-[#EDF2F7] p-4 bg-[#F8FAFC]"
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
                  selected ? "Nhập tin nhắn..." : "Chọn cuộc trò chuyện trước"
                }
                className="min-h-16 flex-1 resize-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] outline-none focus:border-[#4F75FF]"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!selected || sending || !draft.trim()}
                leftIcon={
                  sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )
                }
              >
                Gửi
              </Button>
            </div>
            <div className="mt-1 text-right text-[10px] text-[#94A3B8]">
              {draft.length}/4000
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
