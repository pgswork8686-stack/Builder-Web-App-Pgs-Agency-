import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { commentsApi } from "./comments";
import { filesApi } from "./files";
import { workspaceApi } from "./workspace";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("Phase 4 API clients", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("sends board filters and atomic move through NestJS", () => {
    workspaceApi.board("project-a", {
      q: "Landing page",
      priority: "high",
      status: "review",
    });
    workspaceApi.moveTask("project-a", "task-a", {
      status: "done",
      beforeTaskId: "task-b",
      afterTaskId: null,
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/projects/project-a/board?q=Landing+page&priority=high&status=review",
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/projects/project-a/tasks/task-a/move",
      {
        method: "POST",
        body: JSON.stringify({
          status: "done",
          beforeTaskId: "task-b",
          afterTaskId: null,
        }),
      },
    );
  });

  it("requests only the explicit calendar range", () => {
    workspaceApi.calendar("project-a", "2026-08-01", "2026-08-31");
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project-a/calendar?from=2026-08-01&to=2026-08-31",
    );
  });

  it("keeps comments in a separate paginated task endpoint", () => {
    commentsApi.list("project-a", "task-a", 2, 20);
    commentsApi.create("project-a", "task-a", "Plain text only");
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/projects/project-a/tasks/task-a/comments?page=2&pageSize=20",
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/projects/project-a/tasks/task-a/comments",
      { method: "POST", body: JSON.stringify({ content: "Plain text only" }) },
    );
  });

  it("uses signed upload authorization and finalize endpoints", () => {
    const file = new File(["pdf"], "proposal.pdf", {
      type: "application/pdf",
    });
    filesApi.requestUpload("project-a", file, "task-a");
    filesApi.finalize("project-a", "session-a", "task-a");
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/projects/project-a/tasks/task-a/files/upload-request",
      {
        method: "POST",
        body: JSON.stringify({
          fileName: "proposal.pdf",
          mimeType: "application/pdf",
          sizeBytes: 3,
        }),
      },
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/projects/project-a/tasks/task-a/files/finalize",
      {
        method: "POST",
        body: JSON.stringify({ uploadSessionId: "session-a" }),
      },
    );
  });

  it("requests signed download only when the user asks", () => {
    filesApi.list("project-a", { page: 1, pageSize: 20 });
    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/projects/project-a/files?page=1&pageSize=20",
    );
    filesApi.download("project-a", "file-a");
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/projects/project-a/files/file-a/download",
    );
  });
});
