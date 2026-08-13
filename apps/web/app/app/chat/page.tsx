import { Suspense } from "react";
import { ChatWorkspace } from "@/components/phase7/chat-workspace";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070707] p-8 text-[#FFF8E6]">
          Đang tải chat...
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
