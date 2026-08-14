import { beforeEach, describe, expect, it, vi } from "vitest";
import { automationApi } from "./automation";
import { chatApi } from "./chat";
import { request } from "./client";
import { notificationsApi } from "./notifications";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("Phase 7 API clients", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("keeps notifications behind NestJS endpoints with scoped read actions", () => {
    notificationsApi.list({ page: 2, pageSize: 10, unreadOnly: true });
    notificationsApi.markRead("notification-a");
    notificationsApi.updatePreferences({
      inAppEnabled: true,
      emailEnabled: false,
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/notifications?page=2&pageSize=10&unreadOnly=true",
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/notifications/notification-a/read",
      { method: "PATCH" },
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify({
          inAppEnabled: true,
          emailEnabled: false,
        }),
      },
    );
  });

  it("uses dedicated chat endpoints for membership-checked conversations", () => {
    chatApi.createDirect("peer-user");
    chatApi.getProjectConversation("project-a");
    chatApi.listMessages("conversation-a", {
      limit: 50,
      before: "2026-08-13T00:00:00.000Z",
    });
    chatApi.sendMessage("conversation-a", "Tin nhắn nội bộ");

    expect(requestMock).toHaveBeenNthCalledWith(1, "/chat/direct", {
      method: "POST",
      body: JSON.stringify({ peerUserId: "peer-user" }),
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, "/chat/projects/project-a", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      "/chat/conversations/conversation-a/messages?limit=50&before=2026-08-13T00%3A00%3A00.000Z",
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      "/chat/conversations/conversation-a/messages",
      {
        method: "POST",
        body: JSON.stringify({ content: "Tin nhắn nội bộ" }),
      },
    );
  });

  it("limits automation UI to controlled trigger/action registry", () => {
    automationApi.createRule({
      name: "Nhắc task sắp đến hạn",
      triggerType: "task.due_soon",
      actionType: "create_notification",
      conditions: { daysAhead: 1 },
      actionConfig: { recipientFromPayload: "assigneeUserId" },
      isEnabled: true,
    });
    automationApi.runScheduled();

    expect(requestMock).toHaveBeenNthCalledWith(1, "/automation/rules", {
      method: "POST",
      body: JSON.stringify({
        name: "Nhắc task sắp đến hạn",
        triggerType: "task.due_soon",
        actionType: "create_notification",
        conditions: { daysAhead: 1 },
        actionConfig: { recipientFromPayload: "assigneeUserId" },
        isEnabled: true,
      }),
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/automation/run-scheduled",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  });
});
