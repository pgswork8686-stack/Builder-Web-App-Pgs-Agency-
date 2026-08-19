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
  Search,
  Plus,
  Users,
  Briefcase,
  Building,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { getMe, type AccountPayload } from "@/lib/api/auth";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";
import {
  chatApi,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/api/chat";
import { peopleApi } from "@/lib/api/people";
import { projectsApi, type Project } from "@/lib/api/projects";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "denied";

interface ContactUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  avatarUrl?: string | null;
  employmentProfile?: {
    jobTitle?: string | null;
    employeeCode?: string | null;
  } | null;
}

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

function getRoleBadge(role: string) {
  switch (role?.toLowerCase()) {
    case "admin":
      return (
        <Badge variant="blue" size="sm">
          Admin
        </Badge>
      );
    case "team_leader":
      return (
        <Badge variant="purple" size="sm">
          Trưởng nhóm
        </Badge>
      );
    case "employee":
      return (
        <Badge variant="cyan" size="sm">
          Nhân viên
        </Badge>
      );
    case "accountant":
      return (
        <Badge variant="gold" size="sm">
          Kế toán
        </Badge>
      );
    case "client":
      return (
        <Badge variant="warning" size="sm">
          Khách hàng
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="sm">
          {role}
        </Badge>
      );
  }
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

  // Filter & Search states
  const [conversationSearch, setConversationSearch] = useState("");
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // New Chat Modal state
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"direct" | "project">("direct");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");

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

  const loadContactsAndProjects = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const [peopleRes, projectsRes] = await Promise.allSettled([
        peopleApi.getPeopleDirectory({ pageSize: 100 }),
        projectsApi.getInternalProjects(1, 100).catch(async () => {
          return await projectsApi.getClientProjects(1, 100);
        }),
      ]);

      if (peopleRes.status === "fulfilled" && peopleRes.value?.items) {
        setContacts(peopleRes.value.items as any);
      }
      if (
        projectsRes.status === "fulfilled" &&
        (projectsRes.value as any)?.items
      ) {
        setProjectsList((projectsRes.value as any).items);
      }
    } catch {
      // Non-blocking background loader
    } finally {
      setLoadingContacts(false);
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

    void Promise.all([
      getMe(),
      loadConversations(),
      loadContactsAndProjects(),
    ]).then(([me, list]) => {
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
    loadContactsAndProjects,
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

  const createDirect = async (targetId?: string) => {
    const idToUse = targetId || peerUserId.trim();
    if (!idToUse) return;
    setWorking("direct");
    setError(null);
    try {
      const conversation = await chatApi.createDirect(idToUse);
      await loadConversations();
      await openConversation(conversation);
      setPeerUserId("");
      setNewChatModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không tạo được direct chat. Hãy kiểm tra quyền hạn người dùng.",
      );
    } finally {
      setWorking(null);
    }
  };

  const openProjectChat = async (targetProjId?: string) => {
    const idToUse = targetProjId || projectId.trim();
    if (!idToUse) return;
    setWorking("project");
    setError(null);
    try {
      const conversation = await chatApi.getProjectConversation(idToUse);
      await loadConversations();
      await openConversation(conversation);
      setProjectId("");
      setNewChatModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không mở được project chat. Hãy kiểm tra quyền tham gia dự án.",
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

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!conversationSearch.trim()) return conversations;
    const q = conversationSearch.toLowerCase();
    return conversations.filter((c) =>
      conversationTitle(c).toLowerCase().includes(q),
    );
  }, [conversations, conversationSearch]);

  // Filtered contacts for modal
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (userRoleFilter !== "all" && c.role !== userRoleFilter) return false;
      if (!userSearchQuery.trim()) return true;
      const q = userSearchQuery.toLowerCase();
      const matchName = c.fullName?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      const matchTitle = c.employmentProfile?.jobTitle
        ?.toLowerCase()
        .includes(q);
      const matchCode = c.employmentProfile?.employeeCode
        ?.toLowerCase()
        .includes(q);
      return matchName || matchEmail || matchTitle || matchCode;
    });
  }, [contacts, userRoleFilter, userSearchQuery]);

  // Filtered projects for modal
  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return projectsList;
    const q = projectSearchQuery.toLowerCase();
    return projectsList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.projectCode?.toLowerCase().includes(q),
    );
  }, [projectsList, projectSearchQuery]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chat nội bộ & Dự án"
        description="Trò chuyện trực tiếp giữa nhân sự và thảo luận trao đổi theo từng dự án của PGS Agency."
        action={
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setModalTab("direct");
                setNewChatModalOpen(true);
              }}
              className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
            >
              Cuộc trò chuyện mới
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void loadConversations();
                void loadContactsAndProjects();
              }}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Tải lại
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Left Column: Conversation list and quick search */}
        <aside className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Cuộc trò chuyện
                </h2>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  {conversations.length} cuộc hội thoại
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewChatModalOpen(true)}
                className="text-[#4F75FF] hover:bg-[#EEF2FF] p-1.5 h-8 rounded-lg"
                title="Bắt đầu cuộc trò chuyện mới"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Conversation filter input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] transition-all"
              />
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

            <div className="max-h-[26rem] space-y-2 overflow-y-auto pt-1">
              {loadingList ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#4F75FF]" />
                  Đang tải...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] p-5 text-center text-xs text-[#94A3B8]">
                  {conversationSearch
                    ? "Không tìm thấy cuộc trò chuyện phù hợp."
                    : "Chưa có cuộc trò chuyện nào. Bấm nút '+' để tạo mới."}
                </div>
              ) : (
                filteredConversations.map((conversation) => (
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
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[#64748B] flex items-center gap-1.5">
                          {conversation.type === "project" ? (
                            <span className="text-[#4F75FF] font-semibold">
                              ● Project
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">
                              ● Direct
                            </span>
                          )}
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

          {/* Quick Direct Chat Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-[#4F75FF]" />
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Mở Direct Chat
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModalTab("direct");
                  setNewChatModalOpen(true);
                }}
                className="text-xs text-[#4F75FF] hover:bg-[#EEF2FF] px-2 py-1 h-7"
              >
                Xem danh sách
              </Button>
            </div>
            <p className="text-xs text-[#64748B]">
              Chọn nhanh nhân sự nội bộ hoặc khách hàng để nhắn tin:
            </p>
            <div className="space-y-2 pt-1">
              <select
                disabled={isClient}
                value={peerUserId}
                onChange={(e) => {
                  const val = e.target.value;
                  setPeerUserId(val);
                  if (val) void createDirect(val);
                }}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] cursor-pointer"
              >
                <option value="">-- Chọn nhân sự / khách hàng --</option>
                {contacts.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName || user.email} ({user.role})
                  </option>
                ))}
              </select>

              <Button
                variant="primary"
                size="sm"
                className="w-full bg-[#4F75FF] hover:bg-[#3D61E6] text-white"
                disabled={isClient}
                onClick={() => {
                  setModalTab("direct");
                  setNewChatModalOpen(true);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Tìm kiếm & Chọn nhân sự
              </Button>
            </div>
          </Card>

          {/* Quick Project Chat Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#4F75FF]" />
                <h2 className="font-bold text-[#0F172A] text-sm">
                  Mở Project Chat
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModalTab("project");
                  setNewChatModalOpen(true);
                }}
                className="text-xs text-[#4F75FF] hover:bg-[#EEF2FF] px-2 py-1 h-7"
              >
                Xem dự án
              </Button>
            </div>
            <p className="text-xs text-[#64748B]">
              Chọn nhanh phòng chat theo dự án đang tham gia:
            </p>
            <div className="space-y-2 pt-1">
              <select
                value={projectId}
                onChange={(e) => {
                  const val = e.target.value;
                  setProjectId(val);
                  if (val) void openProjectChat(val);
                }}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] cursor-pointer"
              >
                <option value="">-- Chọn dự án --</option>
                {projectsList.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    [{proj.projectCode}] {proj.name}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setModalTab("project");
                  setNewChatModalOpen(true);
                }}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Tìm kiếm phòng chat dự án
              </Button>
            </div>
          </Card>
        </aside>

        {/* Right Column: Chat window */}
        <Card className="flex min-h-[44rem] flex-col p-0 overflow-hidden">
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
                    ? `${selected.type === "project" ? "Phòng chat dự án" : "Trò chuyện cá nhân"}`
                    : "Chọn một cuộc trò chuyện từ danh sách hoặc bấm 'Cuộc trò chuyện mới'."}
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
              <div className="flex flex-col h-full items-center justify-center text-center text-xs text-[#94A3B8] py-20 space-y-3">
                <MessageCircle className="w-12 h-12 text-[#CBD5E1]" />
                <div>
                  <p className="font-bold text-[#64748B] text-sm mb-1">
                    Bắt đầu cuộc trò chuyện
                  </p>
                  <p>
                    Chọn một cuộc trò chuyện bên trái hoặc tạo cuộc trò chuyện
                    mới.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setNewChatModalOpen(true)}
                  className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white"
                >
                  Tạo cuộc trò chuyện mới
                </Button>
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
                    Chưa có tin nhắn. Hãy gửi tin nhắn đầu tiên để bắt đầu trao
                    đổi!
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
                className="bg-[#4F75FF] hover:bg-[#3D61E6] text-white font-bold"
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

      {/* New Chat Selection Modal */}
      <Dialog
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        maxWidth="lg"
        title="Bắt đầu cuộc trò chuyện"
        description="Tìm kiếm và chọn người dùng hoặc phòng chat dự án để trò chuyện ngay lập tức."
      >
        <div className="space-y-4 pt-2">
          {/* Tabs */}
          <div className="flex border-b border-[#EDF2F7]">
            <button
              type="button"
              onClick={() => setModalTab("direct")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                modalTab === "direct"
                  ? "border-[#4F75FF] text-[#4F75FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Users className="w-4 h-4" />
              Nhân viên & Khách hàng ({filteredContacts.length})
            </button>
            <button
              type="button"
              onClick={() => setModalTab("project")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                modalTab === "project"
                  ? "border-[#4F75FF] text-[#4F75FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Phòng chat Dự án ({filteredProjects.length})
            </button>
          </div>

          {/* Direct Chat Tab */}
          {modalTab === "direct" && (
            <div className="space-y-3">
              {/* Search Bar & Role Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo tên, email, chức danh..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] transition-all"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] cursor-pointer"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="admin">Admin</option>
                  <option value="team_leader">Trưởng nhóm</option>
                  <option value="employee">Nhân viên</option>
                  <option value="accountant">Kế toán</option>
                  <option value="client">Khách hàng</option>
                </select>
              </div>

              {/* User List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {loadingContacts ? (
                  <div className="py-10 text-center text-xs text-[#64748B] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#4F75FF]" />
                    Đang tải danh bạ...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-2xl">
                    Không tìm thấy nhân sự hoặc khách hàng nào.
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => void createDirect(contact.id)}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#EDF2F7] bg-white hover:bg-[#EEF2FF] hover:border-[#4F75FF]/40 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={contact.avatarUrl || undefined}
                          name={contact.fullName || contact.email}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F172A] truncate group-hover:text-[#4F75FF]">
                              {contact.fullName || contact.email}
                            </span>
                            {contact.employmentProfile?.jobTitle && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-[#475569] font-medium">
                                {contact.employmentProfile.jobTitle}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] font-mono truncate">
                            {contact.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {getRoleBadge(contact.role)}
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 text-xs bg-[#4F75FF] hover:bg-[#3D61E6] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Nhắn tin
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Project Chat Tab */}
          {modalTab === "project" && (
            <div className="space-y-3">
              {/* Project Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm dự án theo tên hoặc mã..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] text-xs text-[#0F172A] outline-none focus:bg-white focus:border-[#4F75FF] transition-all"
                />
              </div>

              {/* Project List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredProjects.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-2xl">
                    Không tìm thấy dự án nào.
                  </div>
                ) : (
                  filteredProjects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => void openProjectChat(proj.id)}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-[#EDF2F7] bg-white hover:bg-[#EEF2FF] hover:border-[#4F75FF]/40 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F75FF] flex items-center justify-center shrink-0">
                          <FolderOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F172A] truncate group-hover:text-[#4F75FF]">
                              {proj.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#4F75FF] px-1.5 py-0.5 rounded bg-[#EEF2FF]">
                              {proj.projectCode}
                            </span>
                          </div>
                          {proj.clientCompany?.name && (
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-[#94A3B8]" />
                              {proj.clientCompany.name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            proj.status === "active"
                              ? "success"
                              : proj.status === "completed"
                                ? "blue"
                                : "default"
                          }
                          size="sm"
                        >
                          {proj.status === "active"
                            ? "Đang chạy"
                            : proj.status === "completed"
                              ? "Hoàn thành"
                              : proj.status}
                        </Badge>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 text-xs bg-[#4F75FF] hover:bg-[#3D61E6] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Vào phòng
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-[#EDF2F7]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNewChatModalOpen(false)}
            >
              Đóng
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
