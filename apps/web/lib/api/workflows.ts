import { request } from "./client";

export type WorkflowTemplateStatus = "draft" | "published" | "archived";
export type WorkflowCompletionMode =
  "manual" | "tasks_done" | "tasks_done_and_approval";
export type WorkflowApprovalScope = "internal" | "client" | "both";

export interface WorkflowTemplateStageItem {
  id: string;
  workflow_template_stage_id: string;
  workflow_template_id: string;
  service_delivery_item_id: string;
  service_delivery_item_code?: string | null;
  sort_order: number;
  approval_required: boolean;
  approval_scope: WorkflowApprovalScope | null;
  sla_hours?: number | null;
  auto_create_task: boolean;
  completion_mode: WorkflowCompletionMode;
}

export interface WorkflowTemplateStage {
  id: string;
  workflow_template_id: string;
  stage_code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_required: boolean;
  sla_hours?: number | null;
  items?: WorkflowTemplateStageItem[];
}

export interface WorkflowStageDependency {
  id: string;
  workflow_template_id: string;
  predecessor_stage_id: string;
  successor_stage_id: string;
  lag_hours: number;
}

export interface WorkflowItemDependency {
  id: string;
  workflow_template_id: string;
  predecessor_stage_item_id: string;
  successor_stage_item_id: string;
  lag_hours: number;
}

export interface WorkflowTemplate {
  id: string;
  workflow_code: string;
  service_id: string;
  service_code?: string | null;
  name: string;
  description?: string | null;
  version: number;
  status: WorkflowTemplateStatus;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages?: WorkflowTemplateStage[];
  stage_deps?: WorkflowStageDependency[];
  item_deps?: WorkflowItemDependency[];
}

export interface WorkflowValidationResult {
  errors: string[];
  warnings: string[];
  stats: {
    stages: number;
    requiredItems: number;
    mappedRequiredItems: number;
    optionalItems: number;
    mappedOptionalItems: number;
  };
}

export interface CreateWorkflowTemplatePayload {
  serviceId: string;
  name: string;
  description?: string | null;
}

export interface UpdateWorkflowTemplatePayload {
  name?: string;
  description?: string | null;
}

export interface CreateWorkflowStagePayload {
  name: string;
  description?: string | null;
  sortOrder: number;
  isRequired?: boolean;
  slaHours?: number | null;
}

export type UpdateWorkflowStagePayload = Partial<CreateWorkflowStagePayload>;

export interface ReorderWorkflowStagesPayload {
  stageIds: string[];
}

export interface MapWorkflowItemPayload {
  serviceDeliveryItemId: string;
  sortOrder?: number;
  approvalRequired?: boolean;
  approvalScope?: WorkflowApprovalScope;
  slaHours?: number | null;
  autoCreateTask?: boolean;
  completionMode?: WorkflowCompletionMode;
}

export type UpdateWorkflowItemPayload = Omit<
  Partial<MapWorkflowItemPayload>,
  "serviceDeliveryItemId"
>;

export interface CreateStageDependencyPayload {
  predecessorStageId: string;
  successorStageId: string;
  lagHours?: number;
}

export interface CreateItemDependencyPayload {
  predecessorStageItemId: string;
  successorStageItemId: string;
  lagHours?: number;
}

export interface WorkflowTaskLink {
  id: string;
  task_id: string;
  link_type: "primary" | "supporting";
  created_by_workflow: boolean;
  task?: {
    id: string;
    title: string;
    status: string;
    due_date?: string | null;
  } | null;
}

export interface ProjectWorkflowStageItem {
  id: string;
  project_workflow_stage_id: string;
  project_workflow_id: string;
  project_service_item_id: string;
  project_service_item_code?: string | null;
  approval_required: boolean;
  approval_scope: WorkflowApprovalScope | null;
  sla_hours_snapshot?: number | null;
  completion_mode: WorkflowCompletionMode;
  auto_create_task: boolean;
  status:
    | "locked"
    | "ready"
    | "in_progress"
    | "pending_approval"
    | "completed"
    | "blocked"
    | "skipped";
  due_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  project_service_item?: { name: string; is_required: boolean } | null;
  task_links?: WorkflowTaskLink[];
}

export interface ProjectWorkflowStage {
  id: string;
  project_workflow_id: string;
  project_workflow_stage_code: string;
  name_snapshot: string;
  description_snapshot?: string | null;
  sort_order: number;
  is_required: boolean;
  status: "locked" | "ready" | "in_progress" | "completed" | "skipped";
  sla_hours_snapshot?: number | null;
  due_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  items?: ProjectWorkflowStageItem[];
}

interface ProjectWorkflowDependencyBase {
  id: string;
  project_workflow_id: string;
  dependency_type?: "finish_to_start" | string;
  lag_hours: number;
  eligible_at?: string | null;
  overridden_at?: string | null;
  overridden_by?: string | null;
  override_reason?: string | null;
}

export interface ProjectWorkflowStageDependency extends ProjectWorkflowDependencyBase {
  predecessor_stage_id: string;
  successor_stage_id: string;
}

export interface ProjectWorkflowItemDependency extends ProjectWorkflowDependencyBase {
  predecessor_stage_item_id: string;
  successor_stage_item_id: string;
}

export interface WorkflowApprovalRequest {
  id: string;
  project_id: string;
  project_workflow_id: string;
  project_workflow_stage_id?: string | null;
  project_workflow_stage_item_id?: string | null;
  approval_type: "internal" | "client";
  status: "pending" | "approved" | "rejected" | "cancelled";
  request_note?: string | null;
  decision_note?: string | null;
  requested_at: string;
  responded_at?: string | null;
}

export interface ProjectWorkflow {
  id: string;
  project_id: string;
  project_service_id: string;
  project_workflow_code: string;
  source_workflow_version?: number | null;
  name_snapshot: string;
  status: "not_started" | "in_progress" | "completed" | "on_hold" | "cancelled";
  stages?: ProjectWorkflowStage[];
  stage_dependencies?: ProjectWorkflowStageDependency[];
  item_dependencies?: ProjectWorkflowItemDependency[];
  approvals?: WorkflowApprovalRequest[];
  progress?: {
    completedItems: number;
    requiredItems: number;
    percent: number;
  };
}

export interface InstantiateWorkflowResult {
  instantiated: boolean;
  workflowId?: string;
  isExisting?: boolean;
  reason?: "no_default_workflow";
}

export interface CreateApprovalPayload {
  stageItemId?: string;
  stageId?: string;
  approvalType: "internal" | "client";
  requestNote?: string | null;
}

export interface RespondApprovalPayload {
  decision: "approved" | "rejected";
  decisionNote?: string | null;
}

const encodeId = (id: string) => encodeURIComponent(id);

export const workflowsApi = {
  listTemplates(serviceId?: string): Promise<WorkflowTemplate[]> {
    const query = serviceId ? `?serviceId=${encodeId(serviceId)}` : "";
    return request(`/admin/workflows/templates${query}`);
  },
  getTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}`);
  },
  validateTemplate(id: string): Promise<WorkflowValidationResult> {
    return request(`/admin/workflows/templates/${encodeId(id)}/validate`);
  },
  createTemplate(
    payload: CreateWorkflowTemplatePayload,
  ): Promise<WorkflowTemplate> {
    return request("/admin/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateTemplate(
    id: string,
    payload: UpdateWorkflowTemplatePayload,
  ): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  cloneTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}/clone`, {
      method: "POST",
    });
  },
  publishTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}/publish`, {
      method: "POST",
    });
  },
  setDefault(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}/set-default`, {
      method: "POST",
    });
  },
  archiveTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/${encodeId(id)}/archive`, {
      method: "POST",
    });
  },
  createStage(
    templateId: string,
    payload: CreateWorkflowStagePayload,
  ): Promise<WorkflowTemplateStage> {
    return request(
      `/admin/workflows/templates/${encodeId(templateId)}/stages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  updateStage(
    stageId: string,
    payload: UpdateWorkflowStagePayload,
  ): Promise<WorkflowTemplateStage> {
    return request(`/admin/workflows/stages/${encodeId(stageId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  deleteStage(stageId: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/stages/${encodeId(stageId)}`, {
      method: "DELETE",
    });
  },
  reorderStages(
    templateId: string,
    payload: ReorderWorkflowStagesPayload,
  ): Promise<WorkflowTemplateStage[]> {
    return request(
      `/admin/workflows/templates/${encodeId(templateId)}/stages/reorder`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  mapItem(
    stageId: string,
    payload: MapWorkflowItemPayload,
  ): Promise<WorkflowTemplateStageItem> {
    return request(`/admin/workflows/stages/${encodeId(stageId)}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateMappedItem(
    itemId: string,
    payload: UpdateWorkflowItemPayload,
  ): Promise<WorkflowTemplateStageItem> {
    return request(`/admin/workflows/stage-items/${encodeId(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  removeMappedItem(itemId: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/stage-items/${encodeId(itemId)}`, {
      method: "DELETE",
    });
  },
  createStageDependency(
    templateId: string,
    payload: CreateStageDependencyPayload,
  ): Promise<WorkflowStageDependency> {
    return request(
      `/admin/workflows/templates/${encodeId(templateId)}/stage-dependencies`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  deleteStageDependency(id: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/stage-dependencies/${encodeId(id)}`, {
      method: "DELETE",
    });
  },
  createItemDependency(
    templateId: string,
    payload: CreateItemDependencyPayload,
  ): Promise<WorkflowItemDependency> {
    return request(
      `/admin/workflows/templates/${encodeId(templateId)}/item-dependencies`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  deleteItemDependency(id: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/item-dependencies/${encodeId(id)}`, {
      method: "DELETE",
    });
  },
  getProjectWorkflows(projectId: string): Promise<ProjectWorkflow[]> {
    return request(`/projects/${encodeId(projectId)}/workflows`);
  },
  instantiateProjectServiceWorkflow(
    projectId: string,
    projectServiceId: string,
  ): Promise<InstantiateWorkflowResult> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/project-services/${encodeId(projectServiceId)}/instantiate`,
      { method: "POST" },
    );
  },
  startWorkflow(
    projectId: string,
    workflowId: string,
  ): Promise<ProjectWorkflow> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/${encodeId(workflowId)}/start`,
      { method: "POST" },
    );
  },
  startStage(
    projectId: string,
    stageId: string,
  ): Promise<ProjectWorkflowStage> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/stages/${encodeId(stageId)}/start`,
      { method: "POST" },
    );
  },
  completeStage(
    projectId: string,
    stageId: string,
  ): Promise<ProjectWorkflowStage> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/stages/${encodeId(stageId)}/complete`,
      { method: "POST" },
    );
  },
  completeItem(
    projectId: string,
    itemId: string,
  ): Promise<ProjectWorkflowStageItem> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/items/${encodeId(itemId)}/complete`,
      { method: "POST" },
    );
  },
  overrideDependency(
    projectId: string,
    dependencyId: string,
    reason: string,
  ): Promise<{ id: string; overridden_at: string }> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/dependencies/${encodeId(dependencyId)}/override`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
  listApprovals(
    projectId: string,
    workflowId: string,
  ): Promise<WorkflowApprovalRequest[]> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/${encodeId(workflowId)}/approvals`,
    );
  },
  requestApproval(
    projectId: string,
    workflowId: string,
    payload: CreateApprovalPayload,
  ): Promise<WorkflowApprovalRequest> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/${encodeId(workflowId)}/approvals`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  respondApproval(
    projectId: string,
    workflowId: string,
    approvalId: string,
    payload: RespondApprovalPayload,
  ): Promise<WorkflowApprovalRequest> {
    return request(
      `/projects/${encodeId(projectId)}/workflows/${encodeId(workflowId)}/approvals/${encodeId(approvalId)}/respond`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
};
