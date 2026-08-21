import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { servicesApi } from "@/lib/api/services";
import { workflowsApi, type WorkflowTemplate } from "@/lib/api/workflows";
import { WorkflowBuilder } from "./workflow-builder";

vi.mock("@/lib/api/services", () => ({
  servicesApi: {
    list: vi.fn(),
    listDeliveryItems: vi.fn(),
  },
}));

vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: {
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    validateTemplate: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    createStage: vi.fn(),
    reorderStages: vi.fn(),
    cloneTemplate: vi.fn(),
    publishTemplate: vi.fn(),
    setDefault: vi.fn(),
    archiveTemplate: vi.fn(),
    updateStage: vi.fn(),
    deleteStage: vi.fn(),
    mapItem: vi.fn(),
    updateMappedItem: vi.fn(),
    removeMappedItem: vi.fn(),
    createStageDependency: vi.fn(),
    deleteStageDependency: vi.fn(),
  },
}));

const service = {
  id: "service-1",
  code: "DV_01",
  name: "Marketing",
  active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const baseTemplate: WorkflowTemplate = {
  id: "template-1",
  workflow_code: "QTDV_01",
  service_id: "service-1",
  name: "Delivery Workflow",
  version: 1,
  status: "draft",
  is_default: false,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  stages: [],
  stage_deps: [],
  item_deps: [],
};

const validPreview = {
  errors: [],
  warnings: [],
  stats: {
    stages: 1,
    requiredItems: 1,
    mappedRequiredItems: 1,
    optionalItems: 0,
    mappedOptionalItems: 0,
  },
};

const deliveryItem = {
  id: "delivery-1",
  delivery_item_code: "HMDV_01",
  service_id: "service-1",
  name: "Final assets",
  sort_order: 1,
  is_required: true,
  active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

describe("WorkflowBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(servicesApi.list).mockResolvedValue({
      items: [service],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    });
    vi.mocked(servicesApi.listDeliveryItems).mockResolvedValue([]);
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([baseTemplate]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(baseTemplate);
    vi.mocked(workflowsApi.validateTemplate).mockResolvedValue(validPreview);
  });

  async function selectService() {
    await screen.findByRole("option", { name: "DV_01 — Marketing" });
    fireEvent.change(screen.getByLabelText("Dịch vụ"), {
      target: { value: "service-1" },
    });
    await screen.findAllByText("Delivery Workflow");
  }

  it("renders the Service selector, versions, Draft form, and editing controls", async () => {
    render(<WorkflowBuilder />);
    expect(screen.getByTestId("workflow-builder")).toBeDefined();
    await selectService();
    expect(screen.getByLabelText("Tên bản nháp")).toBeDefined();
    expect(screen.getByRole("button", { name: /Tạo Draft/i })).toBeDefined();
    expect(screen.getByLabelText("Tên Stage")).toBeDefined();
    expect(screen.getByRole("button", { name: /Add Stage/i })).toBeDefined();
    expect(screen.getByLabelText("Workflow Name")).toBeDefined();
    expect(screen.getByLabelText("Workflow Description")).toBeDefined();
  });

  it("hides Draft editing controls for a published immutable Template", async () => {
    const published = {
      ...baseTemplate,
      status: "published" as const,
      stages: [
        {
          id: "stage-1",
          workflow_template_id: baseTemplate.id,
          stage_code: "GDQT_01",
          name: "Discovery",
          sort_order: 1,
          is_required: true,
          items: [],
        },
      ],
    };
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([published]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(published);
    render(<WorkflowBuilder />);
    await selectService();
    expect(screen.queryByLabelText("Tên Stage")).toBeNull();
    expect(screen.queryByLabelText("Workflow Name")).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit Stage/i })).toBeNull();
    expect(
      screen
        .getByRole("button", { name: /^Publish$/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("updates Draft Workflow metadata through updateTemplate", async () => {
    const templateWithDescription = {
      ...baseTemplate,
      description: "Initial description",
    };
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([
      templateWithDescription,
    ]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(
      templateWithDescription,
    );
    vi.mocked(workflowsApi.updateTemplate).mockResolvedValue({
      ...templateWithDescription,
      name: "Updated Delivery Workflow",
      description: "Updated description",
    });

    render(<WorkflowBuilder />);
    await selectService();
    const nameInput = screen.getByLabelText("Workflow Name");
    await waitFor(() =>
      expect((nameInput as HTMLInputElement).value).toBe("Delivery Workflow"),
    );
    fireEvent.change(nameInput, {
      target: { value: " Updated Delivery Workflow " },
    });
    fireEvent.change(screen.getByLabelText("Workflow Description"), {
      target: { value: " Updated description " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Save Workflow Details/i }),
    );

    await waitFor(() =>
      expect(workflowsApi.updateTemplate).toHaveBeenCalledWith("template-1", {
        name: "Updated Delivery Workflow",
        description: "Updated description",
      }),
    );
  });

  it("updates Stage required metadata and SLA in Draft", async () => {
    const stage = {
      id: "stage-1",
      workflow_template_id: baseTemplate.id,
      stage_code: "GDQT_01",
      name: "Discovery",
      sort_order: 1,
      is_required: true,
      sla_hours: 24,
      items: [],
    };
    const stagedTemplate = { ...baseTemplate, stages: [stage] };
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([stagedTemplate]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(stagedTemplate);
    vi.mocked(workflowsApi.updateStage).mockResolvedValue({
      ...stage,
      is_required: false,
      sla_hours: 48,
    });

    render(<WorkflowBuilder />);
    await selectService();
    fireEvent.click(screen.getByRole("button", { name: /Edit Stage/i }));
    fireEvent.change(screen.getByLabelText("Chỉnh SLA Stage"), {
      target: { value: "48" },
    });
    fireEvent.click(screen.getByLabelText("Stage Required stage-1"));
    fireEvent.click(screen.getByRole("button", { name: /Save Stage/i }));

    await waitFor(() =>
      expect(workflowsApi.updateStage).toHaveBeenCalledWith("stage-1", {
        name: "Discovery",
        slaHours: 48,
        isRequired: false,
      }),
    );
  });

  it("moves a Stage with the exact full ordered Stage ID list", async () => {
    const first = {
      id: "stage-1",
      workflow_template_id: baseTemplate.id,
      stage_code: "GDQT_01",
      name: "First",
      sort_order: 1,
      is_required: true,
      items: [],
    };
    const second = {
      ...first,
      id: "stage-2",
      stage_code: "GDQT_02",
      name: "Second",
      sort_order: 2,
    };
    const stagedTemplate = { ...baseTemplate, stages: [first, second] };
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([stagedTemplate]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(stagedTemplate);
    vi.mocked(workflowsApi.reorderStages).mockResolvedValue([second, first]);

    render(<WorkflowBuilder />);
    await selectService();
    fireEvent.click(
      screen.getByRole("button", { name: "Move Stage Second up" }),
    );

    await waitFor(() =>
      expect(workflowsApi.reorderStages).toHaveBeenCalledWith("template-1", {
        stageIds: ["stage-2", "stage-1"],
      }),
    );
  });

  it("shows validation counts and disables Publish when errors exist", async () => {
    vi.mocked(workflowsApi.validateTemplate).mockResolvedValue({
      ...validPreview,
      errors: ["REQUIRED_ITEM_UNMAPPED"],
      stats: { ...validPreview.stats, mappedRequiredItems: 0 },
    });
    render(<WorkflowBuilder />);
    await selectService();
    await waitFor(() =>
      expect(screen.getByText(/REQUIRED_ITEM_UNMAPPED/)).toBeDefined(),
    );
    expect(screen.getByText("0/1")).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: /^Publish$/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("uses the maximum existing Stage sort order after a deletion gap", async () => {
    const stage = {
      id: "stage-2",
      workflow_template_id: baseTemplate.id,
      stage_code: "GDQT_02",
      name: "Delivery",
      sort_order: 2,
      is_required: true,
      items: [],
    };
    const gapTemplate = { ...baseTemplate, stages: [stage] };
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([gapTemplate]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(gapTemplate);
    vi.mocked(workflowsApi.createStage).mockResolvedValue({
      ...stage,
      id: "stage-3",
      stage_code: "GDQT_03",
      name: "Review",
      sort_order: 3,
    });

    render(<WorkflowBuilder />);
    await selectService();
    fireEvent.change(screen.getByLabelText("Tên Stage"), {
      target: { value: "Review" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add Stage/i }));

    await waitFor(() =>
      expect(workflowsApi.createStage).toHaveBeenCalledWith("template-1", {
        name: "Review",
        sortOrder: 3,
        isRequired: true,
        slaHours: null,
      }),
    );
  });

  it("edits an existing mapped Item and makes Tasks + Approval explicit", async () => {
    const mappedItem = {
      id: "mapped-1",
      workflow_template_stage_id: "stage-1",
      workflow_template_id: baseTemplate.id,
      service_delivery_item_id: deliveryItem.id,
      service_delivery_item_code: deliveryItem.delivery_item_code,
      sort_order: 1,
      approval_required: false,
      approval_scope: null,
      sla_hours: null,
      auto_create_task: false,
      completion_mode: "tasks_done" as const,
    };
    const mappedTemplate: WorkflowTemplate = {
      ...baseTemplate,
      stages: [
        {
          id: "stage-1",
          workflow_template_id: baseTemplate.id,
          stage_code: "GDQT_01",
          name: "Delivery",
          sort_order: 1,
          is_required: true,
          items: [mappedItem],
        },
      ],
    };
    vi.mocked(servicesApi.listDeliveryItems).mockResolvedValue([deliveryItem]);
    vi.mocked(workflowsApi.listTemplates).mockResolvedValue([mappedTemplate]);
    vi.mocked(workflowsApi.getTemplate).mockResolvedValue(mappedTemplate);
    vi.mocked(workflowsApi.updateMappedItem).mockResolvedValue({
      ...mappedItem,
      approval_required: true,
      approval_scope: "client",
      completion_mode: "tasks_done_and_approval",
    });

    render(<WorkflowBuilder />);
    await selectService();
    fireEvent.click(screen.getByRole("button", { name: "Edit Delivery Item" }));
    fireEvent.change(screen.getByLabelText("Mapped Completion Mode mapped-1"), {
      target: { value: "tasks_done_and_approval" },
    });

    const approvalRequired = screen.getByLabelText(
      "Mapped Approval Required mapped-1",
    ) as HTMLInputElement;
    const approvalScope = screen.getByLabelText(
      "Mapped Approval Scope mapped-1",
    ) as HTMLSelectElement;
    expect(approvalRequired.checked).toBe(true);
    expect(approvalRequired.disabled).toBe(true);
    expect(approvalScope.disabled).toBe(false);
    fireEvent.change(approvalScope, { target: { value: "client" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Save Delivery Item/i }),
    );

    await waitFor(() =>
      expect(workflowsApi.updateMappedItem).toHaveBeenCalledWith("mapped-1", {
        completionMode: "tasks_done_and_approval",
        approvalRequired: true,
        approvalScope: "client",
        slaHours: null,
        autoCreateTask: false,
      }),
    );
  });

  it("ignores an older Service response after the selection changes", async () => {
    const secondService = {
      ...service,
      id: "service-2",
      code: "DV_02",
      name: "SEO",
    };
    const templateA = { ...baseTemplate, name: "Workflow A" };
    const templateB = {
      ...baseTemplate,
      id: "template-2",
      service_id: secondService.id,
      workflow_code: "QTDV_02",
      name: "Workflow B",
    };
    let resolveFirst!: (templates: WorkflowTemplate[]) => void;
    const firstResponse = new Promise<WorkflowTemplate[]>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(servicesApi.list).mockResolvedValue({
      items: [service, secondService],
      page: 1,
      pageSize: 100,
      total: 2,
      totalPages: 1,
    });
    vi.mocked(workflowsApi.listTemplates).mockImplementation((selectedId) =>
      selectedId === service.id ? firstResponse : Promise.resolve([templateB]),
    );
    vi.mocked(workflowsApi.getTemplate).mockImplementation((templateId) =>
      Promise.resolve(templateId === templateB.id ? templateB : templateA),
    );

    render(<WorkflowBuilder />);
    await screen.findByRole("option", { name: "DV_02 — SEO" });
    fireEvent.change(screen.getByLabelText("Dịch vụ"), {
      target: { value: service.id },
    });
    fireEvent.change(screen.getByLabelText("Dịch vụ"), {
      target: { value: secondService.id },
    });
    await screen.findAllByText("Workflow B");
    resolveFirst([templateA]);

    await waitFor(() => expect(screen.queryByText("Workflow A")).toBeNull());
    expect((screen.getByLabelText("Dịch vụ") as HTMLSelectElement).value).toBe(
      secondService.id,
    );
  });

  it("surfaces Service workflow load failures without an unhandled rejection", async () => {
    vi.mocked(workflowsApi.listTemplates).mockRejectedValue(
      new Error("Workflow versions unavailable"),
    );
    render(<WorkflowBuilder />);
    await screen.findByRole("option", { name: "DV_01 — Marketing" });
    fireEvent.change(screen.getByLabelText("Dịch vụ"), {
      target: { value: service.id },
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Workflow versions unavailable",
    );
    expect(screen.queryByRole("button", { name: /^Publish$/i })).toBeNull();
  });
});
