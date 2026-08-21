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
    requestApproval: vi.fn(),
    overrideDependency: vi.fn(),
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

const operationalWorkflow: ProjectWorkflow = {
  ...workflow,
  approvals: [],
  stage_dependencies: [
    {
      id: "stage-dep-1",
      project_workflow_id: workflow.id,
      predecessor_stage_id: "stage-predecessor",
      successor_stage_id: "stage-target",
      dependency_type: "finish_to_start",
      lag_hours: 2,
    },
  ],
  item_dependencies: [
    {
      id: "item-dep-1",
      project_workflow_id: workflow.id,
      predecessor_stage_item_id: "item-predecessor",
      successor_stage_item_id: "item-target",
      dependency_type: "finish_to_start",
      lag_hours: 1,
    },
  ],
  stages: [
    {
      id: "stage-predecessor",
      project_workflow_id: workflow.id,
      project_workflow_stage_code: "GDDA_01",
      name_snapshot: "Discovery",
      sort_order: 1,
      is_required: true,
      status: "completed",
      completed_at: "2026-08-20T01:00:00.000Z",
      items: [
        {
          id: "item-predecessor",
          project_workflow_stage_id: "stage-predecessor",
          project_workflow_id: workflow.id,
          project_service_item_id: "service-item-source",
          project_service_item_code: "HMDA_SOURCE",
          project_service_item: { name: "Source brief", is_required: true },
          approval_required: false,
          approval_scope: null,
          completion_mode: "tasks_done",
          auto_create_task: false,
          status: "completed",
          completed_at: "2026-08-20T02:00:00.000Z",
          task_links: [],
        },
      ],
    },
    {
      id: "stage-target",
      project_workflow_id: workflow.id,
      project_workflow_stage_code: "GDDA_02",
      name_snapshot: "Locked delivery",
      sort_order: 2,
      is_required: true,
      status: "locked",
      items: [
        {
          id: "item-target",
          project_workflow_stage_id: "stage-target",
          project_workflow_id: workflow.id,
          project_service_item_id: "service-item-target",
          project_service_item_code: "HMDA_TARGET",
          project_service_item: { name: "Final package", is_required: true },
          approval_required: true,
          approval_scope: "both",
          completion_mode: "tasks_done_and_approval",
          auto_create_task: true,
          status: "blocked",
          task_links: [],
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

  it("starts a Workflow and Stage, then completes the eligible Stage with a refresh after each action", async () => {
    const readyStage = {
      ...workflow.stages![0],
      status: "ready" as const,
      items: [],
    };
    const notStarted: ProjectWorkflow = {
      ...workflow,
      status: "not_started",
      approvals: [],
      stages: [readyStage],
    };
    const started: ProjectWorkflow = {
      ...notStarted,
      status: "in_progress",
    };
    const stageStarted: ProjectWorkflow = {
      ...started,
      stages: [{ ...readyStage, status: "in_progress" }],
    };
    const stageCompleted: ProjectWorkflow = {
      ...started,
      stages: [{ ...readyStage, status: "completed" }],
    };
    vi.mocked(workflowsApi.getProjectWorkflows)
      .mockResolvedValueOnce([notStarted])
      .mockResolvedValueOnce([started])
      .mockResolvedValueOnce([stageStarted])
      .mockResolvedValueOnce([stageCompleted]);
    vi.mocked(workflowsApi.startWorkflow).mockResolvedValue(started);
    vi.mocked(workflowsApi.startStage).mockResolvedValue(readyStage);
    vi.mocked(workflowsApi.completeStage).mockResolvedValue({
      ...readyStage,
      status: "completed",
    });

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="admin"
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Bắt đầu Workflow" }),
    );
    await waitFor(() =>
      expect(workflowsApi.startWorkflow).toHaveBeenCalledWith(
        "project-1",
        "workflow-1",
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Bắt đầu Stage" }),
    );
    await waitFor(() =>
      expect(workflowsApi.startStage).toHaveBeenCalledWith(
        "project-1",
        "stage-1",
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Hoàn thành Stage" }),
    );
    await waitFor(() =>
      expect(workflowsApi.completeStage).toHaveBeenCalledWith(
        "project-1",
        "stage-1",
      ),
    );
    expect(await screen.findByTestId("project-stage-completed")).toBeDefined();
    expect(workflowsApi.getProjectWorkflows).toHaveBeenCalledTimes(4);
  });

  it("shows dependency names, lag eligibility, and performs reasoned overrides plus both Approval types", async () => {
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([
      operationalWorkflow,
    ]);
    vi.mocked(workflowsApi.overrideDependency).mockResolvedValue({
      id: "stage-dep-1",
      overridden_at: "2026-08-20T03:00:00.000Z",
    });
    vi.mocked(workflowsApi.requestApproval).mockResolvedValue({
      id: "approval-new",
      project_id: "project-1",
      project_workflow_id: workflow.id,
      project_workflow_stage_id: "stage-target",
      approval_type: "internal",
      status: "pending",
      requested_at: "2026-08-20T04:00:00.000Z",
    });

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate
        mode="internal"
      />,
    );

    const stageReason = await screen.findByTestId(
      "dependency-reason-stage-dep-1",
    );
    expect(stageReason.textContent).toContain("Discovery (completed)");
    expect(stageReason.textContent).toContain("Độ trễ: 2h");
    expect(stageReason.getAttribute("data-eligible-at")).toBe(
      "2026-08-20T03:00:00.000Z",
    );
    const itemReason = screen.getByTestId("dependency-reason-item-dep-1");
    expect(itemReason.textContent).toContain("Source brief (completed)");
    expect(itemReason.textContent).toContain("Độ trễ: 1h");
    expect(itemReason.getAttribute("data-eligible-at")).toBe(
      "2026-08-20T03:00:00.000Z",
    );

    fireEvent.change(screen.getByLabelText("Override reason stage-dep-1"), {
      target: { value: " Urgent client exception " },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Override dependency stage-dep-1",
      }),
    );
    await waitFor(() =>
      expect(workflowsApi.overrideDependency).toHaveBeenCalledWith(
        "project-1",
        "stage-dep-1",
        "Urgent client exception",
      ),
    );

    fireEvent.change(
      await screen.findByLabelText("Approval note stage-target"),
      {
        target: { value: " Need internal check " },
      },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Request internal approval for Locked delivery",
      }),
    );
    await waitFor(() =>
      expect(workflowsApi.requestApproval).toHaveBeenCalledWith(
        "project-1",
        "workflow-1",
        {
          stageId: "stage-target",
          approvalType: "internal",
          requestNote: "Need internal check",
        },
      ),
    );

    fireEvent.change(
      await screen.findByLabelText("Approval note item-target"),
      {
        target: { value: " Please approve assets " },
      },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Request client approval for Final package",
      }),
    );
    await waitFor(() =>
      expect(workflowsApi.requestApproval).toHaveBeenLastCalledWith(
        "project-1",
        "workflow-1",
        {
          stageItemId: "item-target",
          approvalType: "client",
          requestNote: "Please approve assets",
        },
      ),
    );
  });

  it("keeps dependency context visible but hides Approval and override actions without mutation access", async () => {
    vi.mocked(workflowsApi.getProjectWorkflows).mockResolvedValue([
      operationalWorkflow,
    ]);

    render(
      <ProjectWorkflowPanel
        projectId="project-1"
        projectServices={[projectService]}
        canMutate={false}
        mode="internal"
      />,
    );

    expect(
      await screen.findByTestId("dependency-reason-stage-dep-1"),
    ).toBeDefined();
    expect(screen.queryByLabelText("Override reason stage-dep-1")).toBeNull();
    expect(screen.queryByLabelText("Approval note stage-target")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Request internal approval for Locked delivery",
      }),
    ).toBeNull();
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
