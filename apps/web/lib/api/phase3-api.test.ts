import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { projectsApi } from "./projects";
import { servicesApi } from "./services";
import { tasksApi } from "./tasks";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("Phase 3 API clients", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("builds admin project filters without duplicating auth plumbing", () => {
    projectsApi.getAdminProjects({
      q: "PGS 2026",
      status: "active",
      priority: "high",
      page: 2,
      pageSize: 10,
    });

    expect(requestMock).toHaveBeenCalledWith(
      "/admin/projects?q=PGS+2026&status=active&priority=high&page=2&pageSize=10",
    );
  });

  it("uses the scoped internal and client project endpoints", () => {
    projectsApi.getInternalProject("project-a");
    projectsApi.getClientProject("project-a");

    expect(requestMock).toHaveBeenNthCalledWith(1, "/projects/project-a");
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/client/me/projects/project-a",
    );
  });

  it("sends catalog mutations through NestJS", () => {
    servicesApi.create({ code: "SEO", name: "SEO" });

    expect(requestMock).toHaveBeenCalledWith("/admin/services", {
      method: "POST",
      body: JSON.stringify({ code: "SEO", name: "SEO" }),
    });
  });

  it("sends project service assignments through NestJS", () => {
    projectsApi.addProjectService("project-a", {
      serviceId: "service-a",
      status: "planned",
    });

    expect(requestMock).toHaveBeenCalledWith(
      "/admin/projects/project-a/services",
      {
        method: "POST",
        body: JSON.stringify({ serviceId: "service-a", status: "planned" }),
      },
    );
  });

  it("uses the task foundation endpoint and preserves filters", () => {
    tasksApi.list("project-a", {
      status: "in_progress",
      assigneeUserId: "user-a",
      page: 3,
      pageSize: 20,
    });

    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project-a/tasks?status=in_progress&assigneeUserId=user-a&page=3&pageSize=20",
    );
  });
});
