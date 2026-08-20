import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workflowsApi, type ProjectWorkflow } from "@/lib/api/workflows";
import { ProjectWorkflowPanel } from "./project-workflow-panel";

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    getProjectWorkflows: vi.fn(),
    instantiateProjectServiceWorkflow: vi.fn(),
    startWorkflow: vi.fn(),
    startStage: vi.fn(),
    completeStage: vi.fn(),
    completeItem: vi.fn(),
  },
}));

const workflow: ProjectWorkflow = {
  id: "workflow-1",
  project_id: "project-1",
  project_service_id: "project-service-1",
  project_workflow_code: "QTDA_01",
  source_workflow_version: 3,
  name_snapshot: "Campaign Delivery",
  status: "in_progress",
  progress: { completedItems: 1, requiredItems: 2, percent: 50 },
  approvals: [
    {
      id: "approval-1",
      project_id: "project-1",
      project_workflow_id: "workflow-1",
      project_workflow_stage_item_id: "item-1",
      approval_type: "client",
      status: "pending",
      requested_at: "2026-08-20T00:00:00.000Z",
    },
  ],
  stages: [
    {
      id: "stage-1",
      project_workflow_id: "workflow-1",
      project_workflow_stage_code: "GDDA_01",
      name_snapshot: "Client approval",
      sort_order: 1,
      is_required: true,
      status: "locked",
      items: [
        {
          id: "item-1",
          project_workflow_stage_id: "stage-1",
          project_workflow_id: "workflow-1",
          project_service_item_id: "service-item-1",
          project_service_item_code: "HMDA_01",
          project_service_item: { name: "Final assets", is_required: true },
          approval_required: true,
          approval_scope: "client",
          completion_mode: "tasks_done_and_approval",
          auto_create_task: true,
          status: "pending_approval",
          task_links: [
            {
              id: "link-1",
              task_id: "task-exact-123",
              link_type: "primary",
              created_by_workflow: true,
              task: {
                id: "task-exact-123",
                title: "Final assets",
                status: "done",
              },
            },
          ],
        },
      ],
    },
  ],
};

const projectService = {
  id: "project-service-1",
  project_id: "project-1",
  service_id: "service-1",
  status: "active" as const,
  service: {
    id: "service-1",
    code: "DV_01",
    name: "Campaign",
    active: true,
  },
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("ProjectWorkflowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders locked state, Approval state, progress, and the exact shared Task link", async () => {
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([workflow]);
    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="internal"
      />,
    );
    expect(await screen.findByText("Campaign Delivery")).toBeDefined();
    expect(screen.getByTestId("project-stage-locked")).toBeDefined();
    expect(screen.getByText(/Approval pending/)).toBeDefined();
    expect(screen.getByText(/Tiến độ 50%/)).toBeDefined();
    const taskLink = screen.getByText(/Task Final assets/).closest("a");
    expect(taskLink?.getAttribute("href")).toBe(
      "/app/projects/project-1/tasks/task-exact-123",
    );
    expect(taskLink?.getAttribute("data-task-id")).toBe("task-exact-123");
  });

  it("shows the no-default message without failing the Project Service", async () => {
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([]);
    vi.mocked(workflowsApi.instantiateProjectServiceWorkflow).mockResolvedValue(
      {
        instantiated: false,
        reason: "no_default_workflow",
      },
    );
    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="admin"
      />,
    );
    const button = await screen.findByRole("button", {
      name: /Khởi tạo quy trình/i,
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        screen.getByText("Dịch vụ chưa có quy trình mặc định"),
      ).toBeDefined(),
    );
  });

  it("shows the latest Approval per type and includes Stage approvals", async () => {
    const approvalWorkflow: ProjectWorkflow = {
      ...workflow,
      approvals: [
        {
          id: "old-client-approval",
          project_id: "project-1",
          project_workflow_id: workflow.id,
          project_workflow_stage_item_id: "item-1",
          approval_type: "client",
          status: "approved",
          requested_at: "2026-08-19T00:00:00.000Z",
        },
        ...(workflow.approvals ?? []),
        {
          id: "internal-approval",
          project_id: "project-1",
          project_workflow_id: workflow.id,
          project_workflow_stage_item_id: "item-1",
          approval_type: "internal",
          status: "approved",
          requested_at: "2026-08-20T01:00:00.000Z",
        },
        {
          id: "stage-approval",
          project_id: "project-1",
          project_workflow_id: workflow.id,
          project_workflow_stage_id: "stage-1",
          approval_type: "internal",
          status: "rejected",
          requested_at: "2026-08-20T02:00:00.000Z",
        },
      ],
    };
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([
      approvalWorkflow,
    ]);

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="internal"
      />,
    );

    expect(
      await screen.findByText("Approval rejected (internal)"),
    ).toBeDefined();
    const itemText = (await screen.findByTestId("project-item-item-1"))
      .textContent;
    expect(itemText).toContain("Approval approved (internal)");
    expect(itemText).toContain("Approval pending (client)");
    expect(itemText).not.toContain("Approval approved (client)");
  });

  it("completes an Item through panel refresh without reloading the page", async () => {
    const readyItem = {
      ...workflow.stages![0].items![0],
      status: "ready" as const,
    };
    const activeWorkflow: ProjectWorkflow = {
      ...workflow,
      approvals: [],
      stages: [
        {
          ...workflow.stages![0],
          status: "in_progress",
          items: [readyItem],
        },
      ],
    };
    const completedWorkflow: ProjectWorkflow = {
      ...activeWorkflow,
      stages: [
        {
          ...activeWorkflow.stages![0],
          items: [{ ...readyItem, status: "completed" }],
        },
      ],
    };
    vi.mocked(workflowsApi.getProjectWorkflows)
      .mockResolvedValueOnce([activeWorkflow])
      .mockResolvedValueOnce([completedWorkflow]);
    vi.mocked(workflowsApi.completeItem).mockResolvedValue({
      ...readyItem,
      status: "completed",
    });

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="internal"
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Hoàn thành Item" }),
    );

    await waitFor(() =>
      expect(workflowsApi.completeItem).toHaveBeenCalledWith(
        "project-1",
        "item-1",
      ),
    );
    await waitFor(() =>
      expect(workflowsApi.getProjectWorkflows).toHaveBeenCalledTimes(2),
    );
    expect(
      (await screen.findByTestId("project-item-item-1")).textContent,
    ).toContain("completed");
  });

  it("surfaces expected Item completion failures in the panel", async () => {
    const readyWorkflow: ProjectWorkflow = {
      ...workflow,
      approvals: [],
      stages: [
        {
          ...workflow.stages![0],
          status: "in_progress",
          items: [
            {
              ...workflow.stages![0].items![0],
              status: "ready",
            },
          ],
        },
      ],
    };
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([
      readyWorkflow,
    ]);
    vi.mocked(workflowsApi.completeItem).mockRejectedValue(
      new Error("WORKFLOW_TASKS_INCOMPLETE"),
    );

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="internal"
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Hoàn thành Item" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "WORKFLOW_TASKS_INCOMPLETE",
    );
    expect(workflowsApi.getProjectWorkflows).toHaveBeenCalledTimes(1);
  });
});
