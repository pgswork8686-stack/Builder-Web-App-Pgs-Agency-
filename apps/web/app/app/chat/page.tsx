import { Suspense } from "react";
import { ChatWorkspace } from "@/components/phase7/chat-workspace";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-xs text-[#5B6B82]">Đang tải chat...</div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
