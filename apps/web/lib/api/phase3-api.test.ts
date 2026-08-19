import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { projectsApi } from "./projects";
import { servicesApi } from "./services";
import { tasksApi } from "./tasks";
import { cleanCollaboratorTeamIds } from "@/components/phase3/service-catalog-view";

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

  it("updates category with only category fields and without isRequired", () => {
    servicesApi.updateCategory("cat-1", {
      name: "Website Design",
      sortOrder: 2,
      active: true,
    });

    expect(requestMock).toHaveBeenCalledWith(
      "/admin/service-categories/cat-1",
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Website Design",
          sortOrder: 2,
          active: true,
        }),
      },
    );
  });

  it("sends isRequired on create and update delivery items", () => {
    servicesApi.createDeliveryItem("svc-1", {
      name: "Bản khảo sát",
      isRequired: true,
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      "/admin/services/svc-1/delivery-items",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Bản khảo sát",
          isRequired: true,
        }),
      },
    );

    servicesApi.updateDeliveryItem("svc-1", "item-1", {
      isRequired: false,
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "/admin/services/svc-1/delivery-items/item-1",
      {
        method: "PATCH",
        body: JSON.stringify({
          isRequired: false,
        }),
      },
    );
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

describe("cleanCollaboratorTeamIds UI state helper", () => {
  const teams = [
    { id: "team-1", departmentId: "dept-1" },
    { id: "team-2", departmentId: "dept-1" },
    { id: "team-3", departmentId: "dept-2" },
    { id: "team-4", departmentId: "dept-3" },
  ];

  it("removes teams belonging to removed collaborating department", () => {
    const result = cleanCollaboratorTeamIds(
      ["team-3", "team-4"],
      "dept-1",
      "team-1",
      ["dept-2"], // dept-3 was removed
      teams,
    );
    expect(result).toEqual(["team-3"]);
  });

  it("removes owner team from collaborator team list", () => {
    const result = cleanCollaboratorTeamIds(
      ["team-1", "team-3"],
      "dept-1",
      "team-1", // team-1 is selected as owner team
      ["dept-2"],
      teams,
    );
    expect(result).toEqual(["team-3"]);
  });

  it("cleans up all collaborator teams when changing to an owner department with no collaborators", () => {
    const result = cleanCollaboratorTeamIds(
      ["team-3", "team-4"],
      "dept-1",
      "team-1",
      [], // no collaborating departments
      teams,
    );
    expect(result).toEqual([]);
  });
});
