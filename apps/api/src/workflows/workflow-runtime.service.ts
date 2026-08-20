import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { AutomationService } from '../automation/automation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TasksService } from '../tasks/tasks.service';
import type {
  CreateApprovalRequestDto,
  RespondApprovalDto,
} from './dto/workflow.dto';
import { WorkflowSlaService } from './workflow-sla.service';

export type WorkflowAccessMode = 'read' | 'write';

export interface WorkflowProjectAccess {
  isAdmin: boolean;
  isProjectManager: boolean;
  isClient: boolean;
  projectRole: string | null;
}

interface RuntimeServiceItemSnapshot {
  is_required?: boolean;
}

interface RuntimeItemSummary {
  status?: unknown;
  project_service_item?:
    RuntimeServiceItemSnapshot | RuntimeServiceItemSnapshot[];
}

interface RuntimeStageSummary {
  items?: RuntimeItemSummary[];
}

@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly tasksService: TasksService,
    private readonly slaService: WorkflowSlaService,
    private readonly automation?: AutomationService,
  ) {}

  private get client() {
    return this.supabase.getSystemClient();
  }

  private databaseFailure(code: string, error: unknown): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({
      code,
      message: 'Workflow database operation failed.',
    });
  }

  private clientVisibleDependencies(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.map((dependency) => {
      if (!dependency || typeof dependency !== 'object') return dependency;
      const visible = { ...(dependency as Record<string, unknown>) };
      delete visible.overridden_by;
      delete visible.override_reason;
      return visible;
    });
  }

  async requireProjectAccess(
    projectId: string,
    user: RequestUser,
    accessMode: WorkflowAccessMode,
  ): Promise<WorkflowProjectAccess> {
    const { data: project, error: projectError } = await this.client
      .from('projects')
      .select('id,client_company_id,project_manager_user_id')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError)
      this.databaseFailure('WORKFLOW_PROJECT_LOOKUP_FAILED', projectError);
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found.',
      });
    }

    if (user.role === 'admin') {
      return {
        isAdmin: true,
        isProjectManager: true,
        isClient: false,
        projectRole: 'project_manager',
      };
    }

    if (user.role === 'client') {
      if (accessMode === 'write') {
        throw new ForbiddenException({
          code: 'WORKFLOW_PROJECT_MUTATION_DENIED',
          message: 'Clients cannot mutate project workflows.',
        });
      }
      const { data: clientMembership, error } = await this.client
        .from('client_memberships')
        .select('id')
        .eq('client_company_id', project.client_company_id)
        .eq('user_id', user.profileId)
        .maybeSingle();
      if (error)
        this.databaseFailure('WORKFLOW_CLIENT_ACCESS_LOOKUP_FAILED', error);
      if (!clientMembership) {
        throw new ForbiddenException({
          code: 'WORKFLOW_PROJECT_ACCESS_DENIED',
          message: 'Client does not belong to this project company.',
        });
      }
      return {
        isAdmin: false,
        isProjectManager: false,
        isClient: true,
        projectRole: 'client_contact',
      };
    }

    if (
      !['team_leader', 'employee', 'accountant'].includes(String(user.role))
    ) {
      throw new ForbiddenException({
        code: 'WORKFLOW_PROJECT_ACCESS_DENIED',
        message: 'Workflow project access denied.',
      });
    }

    const { data: membership, error } = await this.client
      .from('project_memberships')
      .select('project_role')
      .eq('project_id', projectId)
      .eq('user_id', user.profileId)
      .maybeSingle();
    if (error)
      this.databaseFailure('WORKFLOW_PROJECT_ACCESS_LOOKUP_FAILED', error);
    if (!membership || membership.project_role === 'client_contact') {
      throw new ForbiddenException({
        code: 'WORKFLOW_PROJECT_ACCESS_DENIED',
        message: 'User is not an internal member of this project.',
      });
    }

    const isProjectManager =
      membership.project_role === 'project_manager' ||
      project.project_manager_user_id === user.profileId;
    if (accessMode === 'write' && !isProjectManager) {
      throw new ForbiddenException({
        code: 'WORKFLOW_PROJECT_MUTATION_DENIED',
        message: 'Only the Project Manager can mutate this workflow.',
      });
    }

    return {
      isAdmin: false,
      isProjectManager,
      isClient: false,
      projectRole: String(membership.project_role),
    };
  }

  private async requireWorkflow(projectId: string, workflowId: string) {
    const { data, error } = await this.client
      .from('project_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_RUNTIME_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow was not found in this project.',
      });
    }
    return data as Record<string, unknown>;
  }

  private requireMutableWorkflow(workflow: Record<string, unknown>): void {
    if (['completed', 'cancelled'].includes(String(workflow.status))) {
      throw new ConflictException({
        code: 'WORKFLOW_INVALID_STATE',
        message: 'Completed or cancelled workflow cannot be mutated.',
      });
    }
  }

  private async requireStage(
    projectId: string,
    stageId: string,
    mutable = false,
  ) {
    const { data, error } = await this.client
      .from('project_workflow_stages')
      .select('*')
      .eq('id', stageId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_STAGE_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_STAGE_NOT_FOUND',
        message: 'Workflow stage not found.',
      });
    }
    const workflow = await this.requireWorkflow(
      projectId,
      String(data.project_workflow_id),
    );
    if (mutable) this.requireMutableWorkflow(workflow);
    return data as Record<string, unknown>;
  }

  private async requireItem(
    projectId: string,
    itemId: string,
    mutable = false,
  ) {
    const { data, error } = await this.client
      .from('project_workflow_stage_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_ITEM_NOT_FOUND',
        message: 'Workflow item not found.',
      });
    }
    const workflow = await this.requireWorkflow(
      projectId,
      String(data.project_workflow_id),
    );
    if (mutable) this.requireMutableWorkflow(workflow);
    return data as Record<string, unknown>;
  }

  private async audit(
    projectId: string,
    workflowId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string,
    reason?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client.from('workflow_audit_events').insert({
      project_id: projectId,
      project_workflow_id: workflowId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_user_id: actorId,
      reason: reason ?? null,
      metadata,
    });
    if (error) this.logger.error(`Workflow audit failed: ${error.message}`);
  }

  private async runEvent(
    triggerType:
      | 'workflow.started'
      | 'workflow.stage.ready'
      | 'workflow.stage.started'
      | 'workflow.stage.completed'
      | 'workflow.item.ready'
      | 'workflow.item.completed'
      | 'workflow.approval.requested'
      | 'workflow.approval.approved'
      | 'workflow.approval.rejected',
    entityId: string,
    projectId: string,
    workflowId: string,
    actorId: string,
  ): Promise<void> {
    try {
      await this.automation?.runEvent({
        triggerType,
        eventKey: `${triggerType}:${entityId}`,
        payload: { projectId, workflowId, entityId },
        actorUserId: actorId,
        entityType: triggerType.includes('approval')
          ? 'workflow_approval'
          : triggerType.includes('item')
            ? 'workflow_item'
            : triggerType.includes('stage')
              ? 'workflow_stage'
              : 'workflow',
        entityId,
        actionUrl: `/app/projects/${projectId}`,
      });
    } catch (error) {
      this.logger.error(
        `Workflow automation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async getProjectWorkflows(projectId: string, user: RequestUser) {
    const access = await this.requireProjectAccess(projectId, user, 'read');
    const { data, error } = await this.client
      .from('project_workflows')
      .select(
        '*, stages:project_workflow_stages(*, items:project_workflow_stage_items(*, project_service_item:project_service_items(name,is_required), task_links:project_workflow_task_links(*, task:tasks(id,title,status,due_date)))), stage_dependencies:project_workflow_stage_dependencies(*), item_dependencies:project_workflow_item_dependencies(*), approvals:workflow_approval_requests(*)',
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) this.databaseFailure('WORKFLOW_RUNTIME_LIST_FAILED', error);

    return (data ?? []).map((workflow) => {
      const stages: RuntimeStageSummary[] = Array.isArray(workflow.stages)
        ? workflow.stages
        : [];
      const requiredItems = stages
        .flatMap((stage: RuntimeStageSummary) =>
          Array.isArray(stage.items) ? stage.items : [],
        )
        .filter((item: RuntimeItemSummary) => {
          const snapshot = Array.isArray(item.project_service_item)
            ? item.project_service_item[0]
            : item.project_service_item;
          return snapshot?.is_required !== false;
        });
      const completedItems = requiredItems.filter((item: RuntimeItemSummary) =>
        ['completed', 'skipped'].includes(String(item.status)),
      ).length;
      const visibleStages = access.isClient
        ? stages.map((stage) => ({
            ...stage,
            items: (stage.items ?? []).map((item) => ({
              ...item,
              task_links: [],
            })),
          }))
        : stages;
      const approvals: Array<Record<string, unknown>> = Array.isArray(
        workflow.approvals,
      )
        ? (workflow.approvals as Array<Record<string, unknown>>)
        : [];
      const visibleApprovals = access.isClient
        ? approvals
            .filter((approval) => approval.approval_type === 'client')
            .map((approval) => ({
              id: approval.id,
              project_workflow_stage_id:
                approval.project_workflow_stage_id ?? null,
              project_workflow_stage_item_id:
                approval.project_workflow_stage_item_id ?? null,
              approval_type: approval.approval_type,
              status: approval.status,
              requested_at: approval.requested_at,
              responded_at: approval.responded_at ?? null,
            }))
        : approvals;
      return {
        ...workflow,
        stages: visibleStages,
        stage_dependencies: access.isClient
          ? this.clientVisibleDependencies(workflow.stage_dependencies)
          : workflow.stage_dependencies,
        item_dependencies: access.isClient
          ? this.clientVisibleDependencies(workflow.item_dependencies)
          : workflow.item_dependencies,
        approvals: visibleApprovals,
        progress: {
          completedItems,
          requiredItems: requiredItems.length,
          percent:
            requiredItems.length === 0
              ? 0
              : Math.round((completedItems / requiredItems.length) * 100),
        },
      };
    });
  }

  async instantiateProjectServiceWorkflow(
    projectId: string,
    projectServiceId: string,
    user: RequestUser,
  ) {
    await this.requireProjectAccess(projectId, user, 'write');
    const { data, error } = await this.client.rpc(
      'workflow_instantiate_project_service',
      {
        p_project_id: projectId,
        p_project_service_id: projectServiceId,
        p_actor_id: user.profileId,
      },
    );
    if (error) {
      this.logger.error(`Workflow instantiate failed: ${error.message}`);
      if (String(error.message).includes('WORKFLOW_SNAPSHOT_INCONSISTENT')) {
        throw new ConflictException({
          code: 'WORKFLOW_SNAPSHOT_INCONSISTENT',
          message: 'Project service items do not match the workflow template.',
        });
      }
      if (String(error.message).includes('WORKFLOW_PROJECT_SERVICE_MISMATCH')) {
        throw new NotFoundException({
          code: 'WORKFLOW_PROJECT_SERVICE_NOT_FOUND',
          message: 'Project service was not found in this project.',
        });
      }
      throw new InternalServerErrorException({
        code: 'WORKFLOW_INSTANTIATE_FAILED',
        message: 'Failed to instantiate project workflow.',
      });
    }
    const result = data as {
      instantiated: boolean;
      workflowId?: string;
      isExisting?: boolean;
      reason?: string;
    };
    if (result.instantiated && result.workflowId) {
      await this.ensureReadyAutoTasks(projectId, result.workflowId, user);
      if (!result.isExisting) {
        const { data: readyStages, error: readyStageError } = await this.client
          .from('project_workflow_stages')
          .select('id')
          .eq('project_workflow_id', result.workflowId)
          .eq('status', 'ready');
        if (readyStageError) {
          this.databaseFailure('WORKFLOW_STAGE_LOOKUP_FAILED', readyStageError);
        }
        for (const stage of readyStages ?? []) {
          await this.runEvent(
            'workflow.stage.ready',
            String(stage.id),
            projectId,
            result.workflowId,
            user.profileId,
          );
        }
      }
    }
    return result;
  }

  private async ensureReadyAutoTasks(
    projectId: string,
    workflowId: string,
    user: RequestUser,
  ): Promise<void> {
    const { data: items, error } = await this.client
      .from('project_workflow_stage_items')
      .select('id,project_service_item_id')
      .eq('project_workflow_id', workflowId)
      .eq('auto_create_task', true)
      .eq('status', 'ready');
    if (error) this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', error);
    for (const item of items ?? []) {
      await this.ensurePrimaryTask(
        projectId,
        String(item.id),
        String(item.project_service_item_id),
        user,
      );
    }
  }

  private async ensurePrimaryTask(
    projectId: string,
    workflowItemId: string,
    projectServiceItemId: string,
    user: RequestUser,
  ) {
    const { data: existing, error: existingError } = await this.client
      .from('project_workflow_task_links')
      .select('task_id')
      .eq('project_workflow_stage_item_id', workflowItemId)
      .eq('link_type', 'primary')
      .maybeSingle();
    if (existingError)
      this.databaseFailure('WORKFLOW_TASK_LINK_LOOKUP_FAILED', existingError);
    if (existing) return existing.task_id;

    const { data: serviceItem, error: itemError } = await this.client
      .from('project_service_items')
      .select('name')
      .eq('id', projectServiceItemId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (itemError)
      this.databaseFailure('WORKFLOW_PROJECT_ITEM_LOOKUP_FAILED', itemError);
    if (!serviceItem) {
      throw new ConflictException({
        code: 'WORKFLOW_SNAPSHOT_INCONSISTENT',
        message: 'Project service item is missing.',
      });
    }

    const task = await this.tasksService.createTask(
      projectId,
      {
        projectServiceItemId,
        title: String(serviceItem.name),
        status: 'todo',
        priority: 'medium',
        sortOrder: 0,
      },
      user,
      { workflowStageItemId: workflowItemId },
    );
    return task.id;
  }

  async startWorkflow(
    projectId: string,
    workflowId: string,
    user: RequestUser,
  ) {
    await this.requireProjectAccess(projectId, user, 'write');
    const workflow = await this.requireWorkflow(projectId, workflowId);
    if (workflow.status === 'in_progress') return workflow;
    if (workflow.status === 'completed' || workflow.status === 'cancelled') {
      throw new ConflictException({
        code: 'WORKFLOW_INVALID_STATE',
        message: 'Completed or cancelled workflow cannot be started.',
      });
    }
    const { data, error } = await this.client
      .from('project_workflows')
      .update({
        status: 'in_progress',
        started_at: workflow.started_at ?? new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('project_id', projectId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_START_FAILED', error);
    await this.audit(
      projectId,
      workflowId,
      'workflow',
      workflowId,
      'workflow.start',
      user.profileId,
    );
    await this.runEvent(
      'workflow.started',
      workflowId,
      projectId,
      workflowId,
      user.profileId,
    );
    return data;
  }

  private async unresolvedStagePredecessors(
    workflowId: string,
    stageId: string,
  ): Promise<string[]> {
    const { data: dependencies, error: dependencyError } = await this.client
      .from('project_workflow_stage_dependencies')
      .select('predecessor_stage_id,overridden_at')
      .eq('project_workflow_id', workflowId)
      .eq('successor_stage_id', stageId);
    if (dependencyError) {
      this.databaseFailure(
        'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
        dependencyError,
      );
    }
    const predecessorIds = (dependencies ?? [])
      .filter((dependency) => !dependency.overridden_at)
      .map((dependency) => String(dependency.predecessor_stage_id));
    if (predecessorIds.length === 0) return [];

    const { data: predecessors, error } = await this.client
      .from('project_workflow_stages')
      .select('id,status')
      .in('id', predecessorIds);
    if (error) this.databaseFailure('WORKFLOW_STAGE_LOOKUP_FAILED', error);
    const predecessorById = new Map(
      (predecessors ?? []).map((predecessor) => [
        String(predecessor.id),
        String(predecessor.status),
      ]),
    );
    return predecessorIds.filter((predecessorId) => {
      const status = predecessorById.get(predecessorId);
      return !status || !['completed', 'skipped'].includes(status);
    });
  }

  async startStage(projectId: string, stageId: string, user: RequestUser) {
    await this.requireProjectAccess(projectId, user, 'write');
    const stage = await this.requireStage(projectId, stageId, true);
    if (stage.status === 'in_progress') {
      const activationTime =
        typeof stage.started_at === 'string'
          ? new Date(stage.started_at)
          : new Date();
      await this.activateReadyStageItems(stageId, activationTime);
      await this.ensureReadyAutoTasks(
        projectId,
        String(stage.project_workflow_id),
        user,
      );
      return stage;
    }
    const blockedBy = await this.unresolvedStagePredecessors(
      String(stage.project_workflow_id),
      stageId,
    );
    if (blockedBy.length > 0) {
      throw new ConflictException({
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        message: 'Predecessor stages are incomplete.',
        blockedBy,
      });
    }
    if (stage.status !== 'ready') {
      throw new ConflictException({
        code: 'WORKFLOW_STAGE_INVALID_STATE',
        message: 'Stage is not ready to start.',
      });
    }

    const now = new Date();
    const startedAt =
      typeof stage.started_at === 'string'
        ? stage.started_at
        : now.toISOString();
    const existingDueAt =
      typeof stage.due_at === 'string' ? stage.due_at : null;
    const sla = await this.slaService.calculateDueAt(
      now,
      Number(stage.sla_hours_snapshot ?? 0),
    );
    const { data, error } = await this.client
      .from('project_workflow_stages')
      .update({
        status: 'in_progress',
        started_at: startedAt,
        due_at: existingDueAt ?? (sla.configured ? sla.dueAt : null),
      })
      .eq('id', stageId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_STAGE_START_FAILED', error);
    await this.activateReadyStageItems(stageId, new Date(startedAt));
    await this.ensureReadyAutoTasks(
      projectId,
      String(stage.project_workflow_id),
      user,
    );
    await this.audit(
      projectId,
      String(stage.project_workflow_id),
      'stage',
      stageId,
      'stage.start',
      user.profileId,
    );
    await this.runEvent(
      'workflow.stage.started',
      stageId,
      projectId,
      String(stage.project_workflow_id),
      user.profileId,
    );
    return data;
  }

  private async buildReadyItemUpdate(
    item: Record<string, unknown>,
    readyAt: Date,
  ): Promise<Record<string, unknown>> {
    const update: Record<string, unknown> = { status: 'ready' };
    if (item.due_at !== null && item.due_at !== undefined) return update;

    const slaHours = Number(item.sla_hours_snapshot ?? 0);
    if (!Number.isFinite(slaHours) || slaHours <= 0) return update;
    const sla = await this.slaService.calculateDueAt(readyAt, slaHours);
    if (sla.configured && sla.dueAt) update.due_at = sla.dueAt;
    return update;
  }

  private async activateReadyStageItems(
    stageId: string,
    activatedAt: Date,
  ): Promise<void> {
    const { data: items, error } = await this.client
      .from('project_workflow_stage_items')
      .select('id,status,sla_hours_snapshot,due_at')
      .eq('project_workflow_stage_id', stageId)
      .eq('status', 'ready');
    if (error) this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', error);

    for (const item of items ?? []) {
      const update = await this.buildReadyItemUpdate(item, activatedAt);
      if (typeof update.due_at !== 'string') continue;
      const { error: updateError } = await this.client
        .from('project_workflow_stage_items')
        .update({ due_at: update.due_at })
        .eq('id', item.id)
        .eq('status', 'ready')
        .is('due_at', null);
      if (updateError)
        this.databaseFailure('WORKFLOW_ITEM_UPDATE_FAILED', updateError);
    }
  }

  private async taskRequirementsSatisfied(itemId: string): Promise<boolean> {
    const { data: links, error: linkError } = await this.client
      .from('project_workflow_task_links')
      .select('task_id')
      .eq('project_workflow_stage_item_id', itemId);
    if (linkError)
      this.databaseFailure('WORKFLOW_TASK_LINK_LOOKUP_FAILED', linkError);
    const taskIds = (links ?? []).map((link) => String(link.task_id));
    if (taskIds.length === 0) return false;
    const { data: tasks, error } = await this.client
      .from('tasks')
      .select('id,status')
      .in('id', taskIds);
    if (error) this.databaseFailure('WORKFLOW_TASK_LOOKUP_FAILED', error);
    return (
      (tasks ?? []).length === taskIds.length &&
      (tasks ?? []).every((task) =>
        ['done', 'cancelled'].includes(String(task.status)),
      )
    );
  }

  private async approvalSatisfied(
    item: Record<string, unknown>,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('workflow_approval_requests')
      .select('approval_type,status,requested_at')
      .eq('project_workflow_stage_item_id', String(item.id))
      .order('requested_at', { ascending: false });
    if (error) this.databaseFailure('WORKFLOW_APPROVAL_LOOKUP_FAILED', error);
    const latestByType = new Map<string, string>();
    for (const approval of data ?? []) {
      const approvalType = String(approval.approval_type);
      if (!latestByType.has(approvalType)) {
        latestByType.set(approvalType, String(approval.status));
      }
    }
    const scope = String(item.approval_scope);
    const requiredTypes = scope === 'both' ? ['internal', 'client'] : [scope];
    return (
      requiredTypes.length > 0 &&
      requiredTypes.every(
        (approvalType) => latestByType.get(approvalType) === 'approved',
      )
    );
  }

  private async unresolvedItemPredecessors(
    workflowId: string,
    itemId: string,
  ): Promise<string[]> {
    const { data: dependencies, error: dependencyError } = await this.client
      .from('project_workflow_item_dependencies')
      .select('predecessor_stage_item_id,overridden_at')
      .eq('project_workflow_id', workflowId)
      .eq('successor_stage_item_id', itemId);
    if (dependencyError) {
      this.databaseFailure(
        'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
        dependencyError,
      );
    }
    const predecessorIds = (dependencies ?? [])
      .filter((dependency) => !dependency.overridden_at)
      .map((dependency) => String(dependency.predecessor_stage_item_id));
    if (predecessorIds.length === 0) return [];

    const { data: predecessors, error } = await this.client
      .from('project_workflow_stage_items')
      .select('id,status')
      .in('id', predecessorIds);
    if (error) this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', error);
    const predecessorById = new Map(
      (predecessors ?? []).map((predecessor) => [
        String(predecessor.id),
        String(predecessor.status),
      ]),
    );
    return predecessorIds.filter((predecessorId) => {
      const status = predecessorById.get(predecessorId);
      return !status || !['completed', 'skipped'].includes(status);
    });
  }

  private async requireItemDependenciesResolved(
    workflowId: string,
    itemId: string,
  ): Promise<void> {
    const blockedBy = await this.unresolvedItemPredecessors(workflowId, itemId);
    if (blockedBy.length > 0) {
      throw new ConflictException({
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        message: 'Predecessor workflow items are incomplete.',
        blockedBy,
      });
    }
  }

  async completeItem(projectId: string, itemId: string, user: RequestUser) {
    await this.requireProjectAccess(projectId, user, 'write');
    const item = await this.requireItem(projectId, itemId, true);
    if (item.status === 'completed') return item;
    const parentStage = await this.requireStage(
      projectId,
      String(item.project_workflow_stage_id),
      true,
    );
    if (!['ready', 'in_progress'].includes(String(parentStage.status))) {
      throw new ConflictException({
        code: 'WORKFLOW_ITEM_INVALID_STATE',
        message: 'Parent Stage is not active.',
      });
    }
    await this.requireItemDependenciesResolved(
      String(item.project_workflow_id),
      itemId,
    );
    if (
      !['ready', 'in_progress', 'pending_approval'].includes(
        String(item.status),
      )
    ) {
      throw new ConflictException({
        code: 'WORKFLOW_ITEM_INVALID_STATE',
        message: 'Workflow item is not ready to complete.',
      });
    }
    if (item.completion_mode !== 'manual') {
      const tasksDone = await this.taskRequirementsSatisfied(itemId);
      if (!tasksDone) {
        throw new ConflictException({
          code: 'WORKFLOW_TASKS_INCOMPLETE',
          message: 'All linked non-cancelled tasks must be done.',
        });
      }
    }
    if (
      item.completion_mode === 'tasks_done_and_approval' &&
      !(await this.approvalSatisfied(item))
    ) {
      throw new ConflictException({
        code: 'WORKFLOW_APPROVAL_PENDING',
        message: 'An approved request is required.',
      });
    }
    const completed = await this.markItemCompleted(projectId, item, user);
    await this.unlockItemSuccessors(projectId, item, user);
    return completed;
  }

  private async markItemCompleted(
    projectId: string,
    item: Record<string, unknown>,
    user: RequestUser,
  ) {
    const itemId = String(item.id);
    const workflowId = String(item.project_workflow_id);
    const { data, error } = await this.client
      .from('project_workflow_stage_items')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_ITEM_COMPLETE_FAILED', error);
    await this.audit(
      projectId,
      workflowId,
      'item',
      itemId,
      'item.complete',
      user.profileId,
    );
    await this.runEvent(
      'workflow.item.completed',
      itemId,
      projectId,
      workflowId,
      user.profileId,
    );
    return data;
  }

  private async unlockItemSuccessors(
    projectId: string,
    item: Record<string, unknown>,
    user: RequestUser,
  ): Promise<void> {
    const workflowId = String(item.project_workflow_id);
    const readyAt = new Date();
    const { data: outgoing, error } = await this.client
      .from('project_workflow_item_dependencies')
      .select('successor_stage_item_id')
      .eq('project_workflow_id', workflowId)
      .eq('predecessor_stage_item_id', String(item.id));
    if (error) this.databaseFailure('WORKFLOW_DEPENDENCY_LOOKUP_FAILED', error);
    for (const dependency of outgoing ?? []) {
      const successorId = String(dependency.successor_stage_item_id);
      const { data: incoming, error: incomingError } = await this.client
        .from('project_workflow_item_dependencies')
        .select('predecessor_stage_item_id,overridden_at')
        .eq('project_workflow_id', workflowId)
        .eq('successor_stage_item_id', successorId);
      if (incomingError)
        this.databaseFailure(
          'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
          incomingError,
        );
      const predecessorIds = (incoming ?? [])
        .filter((candidate) => !candidate.overridden_at)
        .map((candidate) => String(candidate.predecessor_stage_item_id));
      let resolved = true;
      if (predecessorIds.length > 0) {
        const { data: predecessors, error: predecessorError } =
          await this.client
            .from('project_workflow_stage_items')
            .select('status')
            .in('id', predecessorIds);
        if (predecessorError)
          this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', predecessorError);
        resolved =
          (predecessors ?? []).length === predecessorIds.length &&
          (predecessors ?? []).every((candidate) =>
            ['completed', 'skipped'].includes(String(candidate.status)),
          );
      }
      if (resolved) {
        const successor = await this.requireItem(projectId, successorId);
        const stage = await this.requireStage(
          projectId,
          String(successor.project_workflow_stage_id),
        );
        if (['ready', 'in_progress'].includes(String(stage.status))) {
          if (!['locked', 'blocked'].includes(String(successor.status)))
            continue;
          const readyUpdate = await this.buildReadyItemUpdate(
            successor,
            readyAt,
          );
          const { data: unlockedItem, error: unlockError } = await this.client
            .from('project_workflow_stage_items')
            .update(readyUpdate)
            .eq('id', successorId)
            .in('status', ['locked', 'blocked'])
            .select('id')
            .maybeSingle();
          if (unlockError) {
            this.databaseFailure('WORKFLOW_ITEM_UPDATE_FAILED', unlockError);
          }
          if (unlockedItem) {
            await this.runEvent(
              'workflow.item.ready',
              successorId,
              projectId,
              workflowId,
              user.profileId,
            );
          }
        }
      }
    }
    await this.ensureReadyAutoTasks(projectId, workflowId, user);
  }

  async completeStage(projectId: string, stageId: string, user: RequestUser) {
    await this.requireProjectAccess(projectId, user, 'write');
    const stage = await this.requireStage(projectId, stageId, true);
    if (stage.status !== 'in_progress') {
      throw new ConflictException({
        code: 'WORKFLOW_STAGE_INVALID_STATE',
        message: 'Only an in-progress Stage can be completed.',
      });
    }
    const blockedBy = await this.unresolvedStagePredecessors(
      String(stage.project_workflow_id),
      stageId,
    );
    if (blockedBy.length > 0) {
      throw new ConflictException({
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        message: 'Predecessor stages are incomplete.',
        blockedBy,
      });
    }
    const { data: items, error: itemError } = await this.client
      .from('project_workflow_stage_items')
      .select('id,status')
      .eq('project_workflow_stage_id', stageId);
    if (itemError)
      this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', itemError);
    const incompleteItems = (items ?? [])
      .filter((item) => !['completed', 'skipped'].includes(String(item.status)))
      .map((item) => String(item.id));
    if (incompleteItems.length > 0) {
      throw new ConflictException({
        code: 'WORKFLOW_STAGE_ITEMS_INCOMPLETE',
        message: 'All stage items must be completed or skipped.',
        incompleteItems,
      });
    }
    const { data, error } = await this.client
      .from('project_workflow_stages')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', stageId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_STAGE_COMPLETE_FAILED', error);
    const workflowId = String(stage.project_workflow_id);
    await this.audit(
      projectId,
      workflowId,
      'stage',
      stageId,
      'stage.complete',
      user.profileId,
    );
    await this.runEvent(
      'workflow.stage.completed',
      stageId,
      projectId,
      workflowId,
      user.profileId,
    );
    await this.unlockStageSuccessors(projectId, workflowId, stageId, user);
    await this.completeWorkflowIfReady(projectId, workflowId);
    return data;
  }

  private async unlockStageSuccessors(
    projectId: string,
    workflowId: string,
    stageId: string,
    user: RequestUser,
  ): Promise<void> {
    const readyAt = new Date();
    const { data: outgoing, error } = await this.client
      .from('project_workflow_stage_dependencies')
      .select('successor_stage_id')
      .eq('project_workflow_id', workflowId)
      .eq('predecessor_stage_id', stageId);
    if (error) this.databaseFailure('WORKFLOW_DEPENDENCY_LOOKUP_FAILED', error);
    for (const dependency of outgoing ?? []) {
      const successorId = String(dependency.successor_stage_id);
      const { data: incoming, error: incomingError } = await this.client
        .from('project_workflow_stage_dependencies')
        .select('predecessor_stage_id,overridden_at')
        .eq('project_workflow_id', workflowId)
        .eq('successor_stage_id', successorId);
      if (incomingError)
        this.databaseFailure(
          'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
          incomingError,
        );
      const predecessorIds = (incoming ?? [])
        .filter((candidate) => !candidate.overridden_at)
        .map((candidate) => String(candidate.predecessor_stage_id));
      let resolved = true;
      if (predecessorIds.length > 0) {
        const { data: predecessors, error: predecessorError } =
          await this.client
            .from('project_workflow_stages')
            .select('status')
            .in('id', predecessorIds);
        if (predecessorError) {
          this.databaseFailure(
            'WORKFLOW_STAGE_LOOKUP_FAILED',
            predecessorError,
          );
        }
        resolved =
          (predecessors ?? []).length === predecessorIds.length &&
          (predecessors ?? []).every((candidate) =>
            ['completed', 'skipped'].includes(String(candidate.status)),
          );
      }
      if (!resolved) continue;
      const { data: unlockedStage, error: stageUnlockError } = await this.client
        .from('project_workflow_stages')
        .update({ status: 'ready' })
        .eq('id', successorId)
        .eq('status', 'locked')
        .select('id')
        .maybeSingle();
      if (stageUnlockError) {
        this.databaseFailure('WORKFLOW_STAGE_UPDATE_FAILED', stageUnlockError);
      }
      if (!unlockedStage) continue;
      const { data: successorItems, error: successorItemsError } =
        await this.client
          .from('project_workflow_stage_items')
          .select('id,status,sla_hours_snapshot,due_at')
          .eq('project_workflow_stage_id', successorId);
      if (successorItemsError) {
        this.databaseFailure(
          'WORKFLOW_ITEM_LOOKUP_FAILED',
          successorItemsError,
        );
      }
      for (const successorItem of successorItems ?? []) {
        const blockedBy = await this.unresolvedItemPredecessors(
          workflowId,
          String(successorItem.id),
        );
        if (blockedBy.length === 0) {
          if (!['locked', 'blocked'].includes(String(successorItem.status)))
            continue;
          const readyUpdate = await this.buildReadyItemUpdate(
            successorItem,
            readyAt,
          );
          const { data: unlockedItem, error: itemUnlockError } =
            await this.client
              .from('project_workflow_stage_items')
              .update(readyUpdate)
              .eq('id', successorItem.id)
              .in('status', ['locked', 'blocked'])
              .select('id')
              .maybeSingle();
          if (itemUnlockError) {
            this.databaseFailure(
              'WORKFLOW_ITEM_UPDATE_FAILED',
              itemUnlockError,
            );
          }
          if (unlockedItem) {
            await this.runEvent(
              'workflow.item.ready',
              String(successorItem.id),
              projectId,
              workflowId,
              user.profileId,
            );
          }
        }
      }
      await this.runEvent(
        'workflow.stage.ready',
        successorId,
        projectId,
        workflowId,
        user.profileId,
      );
    }
    await this.ensureReadyAutoTasks(projectId, workflowId, user);
  }

  private async completeWorkflowIfReady(
    projectId: string,
    workflowId: string,
  ): Promise<void> {
    const { data: requiredStages, error } = await this.client
      .from('project_workflow_stages')
      .select('status')
      .eq('project_workflow_id', workflowId)
      .eq('is_required', true);
    if (error) this.databaseFailure('WORKFLOW_STAGE_LOOKUP_FAILED', error);
    if (
      (requiredStages ?? []).every((stage) =>
        ['completed', 'skipped'].includes(String(stage.status)),
      )
    ) {
      const { error: completionError } = await this.client
        .from('project_workflows')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', workflowId)
        .eq('project_id', projectId);
      if (completionError)
        this.databaseFailure('WORKFLOW_COMPLETE_FAILED', completionError);
    }
  }

  async overrideDependency(
    projectId: string,
    dependencyId: string,
    reason: string,
    user: RequestUser,
  ) {
    await this.requireProjectAccess(projectId, user, 'write');
    const { data: stageDependency, error: stageLookupError } = await this.client
      .from('project_workflow_stage_dependencies')
      .select('*')
      .eq('id', dependencyId)
      .maybeSingle();
    if (stageLookupError) {
      this.databaseFailure(
        'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
        stageLookupError,
      );
    }
    let dependency = stageDependency;
    let dependencyKind: 'stage' | 'item' = 'stage';
    if (!dependency) {
      const { data: itemDependency, error: itemLookupError } = await this.client
        .from('project_workflow_item_dependencies')
        .select('*')
        .eq('id', dependencyId)
        .maybeSingle();
      if (itemLookupError) {
        this.databaseFailure(
          'WORKFLOW_DEPENDENCY_LOOKUP_FAILED',
          itemLookupError,
        );
      }
      dependency = itemDependency;
      dependencyKind = 'item';
    }
    if (!dependency) {
      throw new NotFoundException({
        code: 'WORKFLOW_DEPENDENCY_NOT_FOUND',
        message: 'Workflow dependency not found.',
      });
    }
    const workflow = await this.requireWorkflow(
      projectId,
      String(dependency.project_workflow_id),
    );
    this.requireMutableWorkflow(workflow);
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      throw new BadRequestException({
        code: 'WORKFLOW_OVERRIDE_REASON_INVALID',
        message: 'Reason must be at least 3 characters.',
      });
    }
    const { data, error } = await this.client
      .from(
        dependencyKind === 'stage'
          ? 'project_workflow_stage_dependencies'
          : 'project_workflow_item_dependencies',
      )
      .update({
        overridden_at: new Date().toISOString(),
        overridden_by: user.profileId,
        override_reason: trimmedReason,
      })
      .eq('id', dependencyId)
      .select()
      .single();
    if (error)
      this.databaseFailure('WORKFLOW_DEPENDENCY_OVERRIDE_FAILED', error);
    await this.audit(
      projectId,
      String(dependency.project_workflow_id),
      'dependency',
      dependencyId,
      'dependency.override',
      user.profileId,
      trimmedReason,
    );
    if (dependencyKind === 'stage') {
      await this.unlockStageSuccessors(
        projectId,
        String(dependency.project_workflow_id),
        String(dependency.predecessor_stage_id),
        user,
      );
    } else {
      await this.unlockItemSuccessors(
        projectId,
        {
          id: dependency.predecessor_stage_item_id,
          project_workflow_id: dependency.project_workflow_id,
        },
        user,
      );
    }
    return data;
  }

  async listApprovals(
    projectId: string,
    workflowId: string,
    user: RequestUser,
  ) {
    const access = await this.requireProjectAccess(projectId, user, 'read');
    await this.requireWorkflow(projectId, workflowId);
    let query = this.client
      .from('workflow_approval_requests')
      .select(
        access.isClient
          ? 'id,project_workflow_stage_id,project_workflow_stage_item_id,approval_type,status,requested_at,responded_at'
          : '*',
      )
      .eq('project_workflow_id', workflowId);
    if (access.isClient) query = query.eq('approval_type', 'client');
    const { data, error } = await query.order('requested_at', {
      ascending: false,
    });
    if (error) this.databaseFailure('WORKFLOW_APPROVAL_LIST_FAILED', error);
    return data ?? [];
  }

  async requestApproval(
    projectId: string,
    workflowId: string,
    dto: CreateApprovalRequestDto,
    user: RequestUser,
  ) {
    await this.requireProjectAccess(projectId, user, 'write');
    const workflow = await this.requireWorkflow(projectId, workflowId);
    this.requireMutableWorkflow(workflow);
    if (dto.stageItemId) {
      const item = await this.requireItem(projectId, dto.stageItemId, true);
      if (String(item.project_workflow_id) !== workflowId) {
        throw new NotFoundException({ code: 'WORKFLOW_ITEM_NOT_FOUND' });
      }
      if (
        !['ready', 'in_progress', 'pending_approval'].includes(
          String(item.status),
        )
      ) {
        throw new ConflictException({
          code: 'WORKFLOW_ITEM_INVALID_STATE',
          message: 'Approval cannot be requested for this Item state.',
        });
      }
      const parentStage = await this.requireStage(
        projectId,
        String(item.project_workflow_stage_id),
        true,
      );
      if (!['ready', 'in_progress'].includes(String(parentStage.status))) {
        throw new ConflictException({
          code: 'WORKFLOW_ITEM_INVALID_STATE',
          message: 'Approval cannot be requested while the Stage is locked.',
        });
      }
      const allowedScopes =
        dto.approvalType === 'internal'
          ? ['internal', 'both']
          : ['client', 'both'];
      if (
        !item.approval_required ||
        !allowedScopes.includes(String(item.approval_scope))
      ) {
        throw new BadRequestException({
          code: 'WORKFLOW_APPROVAL_CONFIGURATION_INVALID',
          message: 'Item is not configured for this approval type.',
        });
      }
    } else if (dto.stageId) {
      const stage = await this.requireStage(projectId, dto.stageId, true);
      if (String(stage.project_workflow_id) !== workflowId) {
        throw new NotFoundException({ code: 'WORKFLOW_STAGE_NOT_FOUND' });
      }
      if (!['ready', 'in_progress'].includes(String(stage.status))) {
        throw new ConflictException({
          code: 'WORKFLOW_STAGE_INVALID_STATE',
          message: 'Approval cannot be requested for this Stage state.',
        });
      }
    }
    const { data, error } = await this.client.rpc('workflow_request_approval', {
      p_project_id: projectId,
      p_workflow_id: workflowId,
      p_stage_item_id: dto.stageItemId ?? null,
      p_stage_id: dto.stageId ?? null,
      p_approval_type: dto.approvalType,
      p_request_note: dto.requestNote ?? null,
      p_actor_id: user.profileId,
    });
    if (error) {
      const detail = String(error.message ?? '');
      if (detail.includes('WORKFLOW_APPROVAL_CONFIGURATION_INVALID')) {
        throw new BadRequestException({
          code: 'WORKFLOW_APPROVAL_CONFIGURATION_INVALID',
          message: 'Item is not configured for this approval type.',
        });
      }
      if (
        detail.includes('WORKFLOW_APPROVAL_TARGET_STATE_INVALID') ||
        String(error.code) === '23505'
      ) {
        throw new ConflictException({
          code: 'WORKFLOW_APPROVAL_REQUEST_CONFLICT',
          message: 'Approval is already pending or the target state changed.',
        });
      }
      this.databaseFailure('WORKFLOW_APPROVAL_REQUEST_FAILED', error);
    }
    if (!data) {
      this.databaseFailure('WORKFLOW_APPROVAL_REQUEST_FAILED', {
        message: 'Approval RPC returned no row.',
      });
    }
    await this.audit(
      projectId,
      workflowId,
      'approval',
      String(data.id),
      'approval.request',
      user.profileId,
    );
    await this.runEvent(
      'workflow.approval.requested',
      String(data.id),
      projectId,
      workflowId,
      user.profileId,
    );
    return data;
  }

  async respondApproval(
    projectId: string,
    workflowId: string,
    approvalId: string,
    dto: RespondApprovalDto,
    user: RequestUser,
  ) {
    const { data: approval, error: lookupError } = await this.client
      .from('workflow_approval_requests')
      .select('*')
      .eq('id', approvalId)
      .eq('project_workflow_id', workflowId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (lookupError)
      this.databaseFailure('WORKFLOW_APPROVAL_LOOKUP_FAILED', lookupError);
    if (!approval) {
      throw new NotFoundException({
        code: 'WORKFLOW_APPROVAL_NOT_FOUND',
        message: 'Approval was not found in this project workflow.',
      });
    }
    const workflow = await this.requireWorkflow(projectId, workflowId);
    this.requireMutableWorkflow(workflow);
    if (approval.approval_type === 'client') {
      if (user.role !== 'client') {
        throw new ForbiddenException({
          code: 'WORKFLOW_CLIENT_APPROVAL_DENIED',
          message: 'Client approval must be answered by the project client.',
        });
      }
      await this.requireProjectAccess(projectId, user, 'read');
    } else {
      await this.requireProjectAccess(projectId, user, 'write');
      if (user.role === 'client') {
        throw new ForbiddenException({
          code: 'WORKFLOW_INTERNAL_APPROVAL_DENIED',
          message: 'Clients cannot answer internal approvals.',
        });
      }
    }
    if (approval.status !== 'pending') {
      throw new ConflictException({
        code: 'WORKFLOW_APPROVAL_ALREADY_RESPONDED',
        message: 'Approval request is no longer pending.',
      });
    }
    const { data, error } = await this.client.rpc('workflow_respond_approval', {
      p_project_id: projectId,
      p_workflow_id: workflowId,
      p_approval_id: approvalId,
      p_decision: dto.decision,
      p_decision_note: dto.decisionNote ?? null,
      p_actor_id: user.profileId,
    });
    if (error) {
      const detail = String(error.message ?? '');
      if (detail.includes('WORKFLOW_APPROVAL_ALREADY_RESPONDED')) {
        throw new ConflictException({
          code: 'WORKFLOW_APPROVAL_ALREADY_RESPONDED',
          message: 'Approval request was answered concurrently.',
        });
      }
      if (detail.includes('WORKFLOW_APPROVAL_NOT_FOUND')) {
        throw new NotFoundException({
          code: 'WORKFLOW_APPROVAL_NOT_FOUND',
          message: 'Approval was not found in this project workflow.',
        });
      }
      this.databaseFailure('WORKFLOW_APPROVAL_RESPONSE_FAILED', error);
    }
    if (!data) {
      this.databaseFailure('WORKFLOW_APPROVAL_RESPONSE_FAILED', {
        message: 'Approval RPC returned no row.',
      });
    }

    if (approval.project_workflow_stage_item_id) {
      const item = await this.requireItem(
        projectId,
        String(approval.project_workflow_stage_item_id),
        true,
      );
      if (dto.decision === 'approved') {
        const tasksSatisfied =
          item.completion_mode === 'manual' ||
          (await this.taskRequirementsSatisfied(String(item.id)));
        const blockedBy = await this.unresolvedItemPredecessors(
          String(item.project_workflow_id),
          String(item.id),
        );
        const parentStage = await this.requireStage(
          projectId,
          String(item.project_workflow_stage_id),
          true,
        );
        const stageActive = ['ready', 'in_progress'].includes(
          String(parentStage.status),
        );
        const approvalsSatisfied = await this.approvalSatisfied(item);
        if (
          tasksSatisfied &&
          approvalsSatisfied &&
          blockedBy.length === 0 &&
          stageActive
        ) {
          await this.markItemCompleted(projectId, item, user);
          await this.unlockItemSuccessors(projectId, item, user);
        }
      }
    }

    const action =
      dto.decision === 'approved' ? 'approval.approve' : 'approval.reject';
    const trigger =
      dto.decision === 'approved'
        ? 'workflow.approval.approved'
        : 'workflow.approval.rejected';
    await this.audit(
      projectId,
      workflowId,
      'approval',
      approvalId,
      action,
      user.profileId,
    );
    await this.runEvent(
      trigger,
      approvalId,
      projectId,
      workflowId,
      user.profileId,
    );
    return data;
  }
}
