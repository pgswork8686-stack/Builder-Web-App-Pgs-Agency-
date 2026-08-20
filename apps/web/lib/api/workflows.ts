import { request } from './client';

export interface WorkflowTemplate {
  id: string;
  workflow_code: string;
  service_id: string;
  service_code: string;
  name: string;
  description?: string | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages?: WorkflowTemplateStage[];
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

export interface WorkflowTemplateStageItem {
  id: string;
  stage_id: string;
  service_delivery_item_id: string;
  sort_order: number;
  approval_required: boolean;
  approval_scope: 'internal' | 'client' | 'both';
  sla_hours?: number | null;
  auto_create_task: boolean;
  completion_mode: 'manual' | 'tasks_done' | 'tasks_done_and_approval';
}

export interface ProjectWorkflow {
  id: string;
  project_id: string;
  project_service_id: string;
  project_workflow_code: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  stages?: ProjectWorkflowStage[];
}

export interface ProjectWorkflowStage {
  id: string;
  project_workflow_id: string;
  project_workflow_stage_code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_required: boolean;
  status: 'locked' | 'ready' | 'in_progress' | 'completed' | 'skipped';
  sla_hours?: number | null;
  items?: ProjectWorkflowStageItem[];
}

export interface ProjectWorkflowStageItem {
  id: string;
  project_workflow_stage_id: string;
  project_service_item_id: string;
  name?: string;
  status: 'locked' | 'ready' | 'in_progress' | 'completed' | 'skipped';
}

export const workflowsApi = {
  async listTemplates(serviceId?: string): Promise<WorkflowTemplate[]> {
    const query = serviceId ? `?serviceId=` : '';
    return request(`/admin/workflows/templates`);
  },
  async getTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/`);
  },
  async createTemplate(payload: { serviceId: string; name: string; description?: string }): Promise<WorkflowTemplate> {
    return request('/admin/workflows/templates', { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateTemplate(id: string, payload: { name?: string; description?: string }): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async cloneTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates//clone`, { method: 'POST' });
  },
  async publishTemplate(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates//publish`, { method: 'POST' });
  },
  async setDefault(id: string): Promise<WorkflowTemplate> {
    return request(`/admin/workflows/templates//set-default`, { method: 'POST' });
  },
  async createStage(templateId: string, payload: any): Promise<WorkflowTemplateStage> {
    return request(`/admin/workflows/templates//stages`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async updateStage(stageId: string, payload: any): Promise<WorkflowTemplateStage> {
    return request(`/admin/workflows/stages/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async deleteStage(stageId: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/stages/`, { method: 'DELETE' });
  },
  async mapItem(stageId: string, payload: any): Promise<WorkflowTemplateStageItem> {
    return request(`/admin/workflows/stages//items`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async removeMappedItem(itemId: string): Promise<{ success: boolean }> {
    return request(`/admin/workflows/stage-items/`, { method: 'DELETE' });
  },
  async getProjectWorkflows(projectId: string): Promise<ProjectWorkflow[]> {
    return request(`/projects//workflows`);
  },
  async instantiateProjectServiceWorkflow(projectId: string, projectServiceId: string): Promise<{ instantiated: boolean; workflowId?: string; isExisting?: boolean }> {
    return request(`/projects//workflows/project-services//instantiate`, { method: 'POST' });
  },
  async startWorkflow(projectId: string, workflowId: string): Promise<ProjectWorkflow> {
    return request(`/projects//workflows//start`, { method: 'POST' });
  },
  async startStage(projectId: string, stageId: string): Promise<ProjectWorkflowStage> {
    return request(`/projects//workflows/stages//start`, { method: 'POST' });
  },
  async completeStage(projectId: string, stageId: string): Promise<ProjectWorkflowStage> {
    return request(`/projects//workflows/stages//complete`, { method: 'POST' });
  },
  async overrideDependency(projectId: string, dependencyId: string, reason: string): Promise<any> {
    return request(`/projects//workflows/dependencies//override`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
};