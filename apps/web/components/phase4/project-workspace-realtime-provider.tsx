"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";

export interface WorkspaceRealtimeEvent {
  projectId: string;
  entityId: string;
  event: string;
  updatedAt: string;
  changes?: Record<string, unknown>;
}

type ConnectionState =
  "connecting" | "connected" | "reconnecting" | "denied" | "offline";

interface RealtimeContextValue {
  connectionState: ConnectionState;
  revision: number;
  lastEvent: WorkspaceRealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connectionState: "offline",
  revision: 0,
  lastEvent: null,
});

export function ProjectWorkspaceRealtimeProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [revision, setRevision] = useState(0);
  const [lastEvent, setLastEvent] = useState<WorkspaceRealtimeEvent | null>(
    null,
  );
  const joinedOnce = useRef(false);

  useEffect(() => {
    let socket: Socket | null = null;
    let disposed = false;

    void getAccessToken().then((token) => {
      if (disposed || !token) {
        setConnectionState("denied");
        return;
      }
      const apiUrl = new URL(API_BASE_URL);
      socket = io(`${apiUrl.origin}/project-workspace`, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });

      socket.on("connect", () => {
        setConnectionState(joinedOnce.current ? "reconnecting" : "connecting");
        socket?.emit(
          "workspace.join",
          { projectId },
          (response: { ok: boolean }) => {
            if (!response?.ok) {
              setConnectionState("denied");
              return;
            }
            if (joinedOnce.current) setRevision((value) => value + 1);
            joinedOnce.current = true;
            setConnectionState("connected");
          },
        );
      });
      socket.on("disconnect", () => setConnectionState("reconnecting"));
      socket.on("connect_error", () => setConnectionState("reconnecting"));
      socket.on("workspace.error", () => setConnectionState("denied"));
      socket.on("workspace.event", (event: WorkspaceRealtimeEvent) => {
        if (event.projectId !== projectId) return;
        setLastEvent(event);
        setRevision((value) => value + 1);
      });
    });

    return () => {
      disposed = true;
      socket?.disconnect();
    };
  }, [projectId]);

  const value = useMemo(
    () => ({ connectionState, revision, lastEvent }),
    [connectionState, revision, lastEvent],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useProjectWorkspaceRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeStatus() {
  const { connectionState } = useProjectWorkspaceRealtime();
  const labels: Record<ConnectionState, string> = {
    connecting: "Đang kết nối realtime",
    connected: "Realtime đã kết nối",
    reconnecting: "Đang kết nối lại — dữ liệu sẽ được làm mới",
    denied: "Không có quyền realtime",
    offline: "Realtime chưa hoạt động",
  };
  const color =
    connectionState === "connected"
      ? "bg-emerald-400"
      : connectionState === "denied"
        ? "bg-red-400"
        : "bg-amber-400";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {labels[connectionState]}
    </span>
  );
}
