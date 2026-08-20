import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./client";
import { workflowsApi } from "./workflows";

vi.mock("./client", () => ({ request: vi.fn() }));

const requestMock = vi.mocked(request);

describe("Workflow API exact routes", () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({});
  });

  it("appends and encodes serviceId when listing templates", async () => {
    await workflowsApi.listTemplates("service/id");
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/workflows/templates?serviceId=service%2Fid",
    );
  });

  it("gets a template by encoded ID", async () => {
    await workflowsApi.getTemplate("template/id");
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/workflows/templates/template%2Fid",
    );
  });

  it.each([
    ["cloneTemplate", "/admin/workflows/templates/template%2Fid/clone"],
    ["publishTemplate", "/admin/workflows/templates/template%2Fid/publish"],
    ["setDefault", "/admin/workflows/templates/template%2Fid/set-default"],
  ] as const)("calls %s with the exact URL", async (method, url) => {
    await workflowsApi[method]("template/id");
    expect(requestMock).toHaveBeenCalledWith(url, { method: "POST" });
  });

  it("creates a Stage under the exact Template", async () => {
    const payload = { name: "Stage", sortOrder: 1 };
    await workflowsApi.createStage("template/id", payload);
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/workflows/templates/template%2Fid/stages",
      { method: "POST", body: JSON.stringify(payload) },
    );
  });

  it("reorders Stages with the exact ordered IDs", async () => {
    const payload = { stageIds: ["stage-2", "stage-1"] };
    await workflowsApi.reorderStages("template/id", payload);
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/workflows/templates/template%2Fid/stages/reorder",
      { method: "POST", body: JSON.stringify(payload) },
    );
  });

  it("maps an Item under the exact Stage", async () => {
    const payload = { serviceDeliveryItemId: "item-id" };
    await workflowsApi.mapItem("stage/id", payload);
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/workflows/stages/stage%2Fid/items",
      { method: "POST", body: JSON.stringify(payload) },
    );
  });

  it("gets Project Workflows", async () => {
    await workflowsApi.getProjectWorkflows("project/id");
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project%2Fid/workflows",
    );
  });

  it("instantiates a Project Service Workflow", async () => {
    await workflowsApi.instantiateProjectServiceWorkflow(
      "project/id",
      "service/id",
    );
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project%2Fid/workflows/project-services/service%2Fid/instantiate",
      { method: "POST" },
    );
  });

  it("starts the exact Workflow", async () => {
    await workflowsApi.startWorkflow("project/id", "workflow/id");
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project%2Fid/workflows/workflow%2Fid/start",
      { method: "POST" },
    );
  });

  it.each([
    ["startStage", "start"],
    ["completeStage", "complete"],
  ] as const)("calls %s for the exact Stage", async (method, action) => {
    await workflowsApi[method]("project/id", "stage/id");
    expect(requestMock).toHaveBeenCalledWith(
      `/projects/project%2Fid/workflows/stages/stage%2Fid/${action}`,
      { method: "POST" },
    );
  });

  it("overrides the exact dependency with its reason", async () => {
    await workflowsApi.overrideDependency(
      "project/id",
      "dependency/id",
      "Approved exception",
    );
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project%2Fid/workflows/dependencies/dependency%2Fid/override",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Approved exception" }),
      },
    );
  });

  it("uses exact approval list and request routes", async () => {
    await workflowsApi.listApprovals("project/id", "workflow/id");
    expect(requestMock).toHaveBeenLastCalledWith(
      "/projects/project%2Fid/workflows/workflow%2Fid/approvals",
    );

    const payload = { stageItemId: "item-id", approvalType: "client" as const };
    await workflowsApi.requestApproval("project/id", "workflow/id", payload);
    expect(requestMock).toHaveBeenLastCalledWith(
      "/projects/project%2Fid/workflows/workflow%2Fid/approvals",
      { method: "POST", body: JSON.stringify(payload) },
    );
  });

  it("responds to the exact Approval", async () => {
    const payload = { decision: "approved" as const, decisionNote: "OK" };
    await workflowsApi.respondApproval(
      "project/id",
      "workflow/id",
      "approval/id",
      payload,
    );
    expect(requestMock).toHaveBeenCalledWith(
      "/projects/project%2Fid/workflows/workflow%2Fid/approvals/approval%2Fid/respond",
      { method: "POST", body: JSON.stringify(payload) },
    );
  });
});
