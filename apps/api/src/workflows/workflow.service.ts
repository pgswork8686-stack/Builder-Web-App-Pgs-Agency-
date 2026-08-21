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
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateItemDependencyDto,
  CreateStageDependencyDto,
  CreateTemplateStageDto,
  CreateWorkflowTemplateDto,
  MapStageItemDto,
  ReorderTemplateStagesDto,
  UpdateMappedStageItemDto,
  UpdateTemplateStageDto,
  UpdateWorkflowTemplateDto,
} from './dto/workflow.dto';
import { WorkflowValidationService } from './workflow-validation.service';

export interface WorkflowPublishValidation {
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

interface TemplateStageItemRow {
  id: unknown;
  service_delivery_item_id: unknown;
  sla_hours?: unknown;
  approval_scope?: unknown;
  approval_required?: unknown;
  completion_mode?: unknown;
}

interface TemplateStageRow {
  id: unknown;
  sort_order: unknown;
  sla_hours?: unknown;
  items?: TemplateStageItemRow[];
}

interface StageDependencyRow {
  predecessor_stage_id: unknown;
  successor_stage_id: unknown;
}

interface ItemDependencyRow {
  predecessor_stage_item_id: unknown;
  successor_stage_item_id: unknown;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly validation: WorkflowValidationService,
  ) {}

  private get client() {
    return this.supabase.getSystemClient();
  }

  private assertAdmin(user: RequestUser): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_OPERATION',
        message: 'Only administrators can manage workflow templates.',
      });
    }
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

  private workflowRpcFailure(code: string, error: unknown): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : '';
    if (detail.includes('WORKFLOW_TEMPLATE_IMMUTABLE')) {
      throw new ConflictException({
        code: 'WORKFLOW_TEMPLATE_IMMUTABLE',
        message: 'Published or archived workflow templates are immutable.',
      });
    }
    for (const businessCode of [
      'WORKFLOW_DEPENDENCY_CROSS_TEMPLATE',
      'WORKFLOW_STAGE_DEPENDENCY_CYCLE',
      'WORKFLOW_ITEM_DEPENDENCY_CYCLE',
      'WORKFLOW_STAGE_REORDER_INVALID',
    ]) {
      if (detail.includes(businessCode)) {
        throw new BadRequestException({
          code: businessCode,
          message: 'Workflow request violates template graph rules.',
        });
      }
    }
    if (detail.includes('WORKFLOW_DEPENDENCY_NOT_FOUND')) {
      throw new NotFoundException({
        code: 'WORKFLOW_DEPENDENCY_NOT_FOUND',
        message: 'Workflow dependency not found.',
      });
    }
    if (detail.includes('WORKFLOW_TEMPLATE_NOT_FOUND')) {
      throw new NotFoundException({
        code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
        message: 'Workflow template not found.',
      });
    }
    this.databaseFailure(code, error);
  }

  private async assertDraftTemplate(templateId: string) {
    const { data, error } = await this.client
      .from('workflow_templates')
      .select('id,status,service_id')
      .eq('id', templateId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_TEMPLATE_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
        message: 'Workflow template not found.',
      });
    }
    if (data.status !== 'draft') {
      throw new ConflictException({
        code: 'WORKFLOW_TEMPLATE_IMMUTABLE',
        message:
          'Published or archived workflow templates are immutable. Clone to create a new draft.',
      });
    }
    return data;
  }

  private async templateIdForStage(stageId: string): Promise<string> {
    const { data, error } = await this.client
      .from('workflow_template_stages')
      .select('workflow_template_id')
      .eq('id', stageId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_STAGE_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_STAGE_NOT_FOUND',
        message: 'Workflow stage not found.',
      });
    }
    return String(data.workflow_template_id);
  }

  private async templateIdForItem(itemId: string): Promise<string> {
    const { data, error } = await this.client
      .from('workflow_template_stage_items')
      .select('workflow_template_id')
      .eq('id', itemId)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_ITEM_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_ITEM_NOT_FOUND',
        message: 'Workflow item not found.',
      });
    }
    return String(data.workflow_template_id);
  }

  async listTemplates(serviceId?: string) {
    let query = this.client
      .from('workflow_templates')
      .select('*, stages:workflow_template_stages(*)');
    if (serviceId) query = query.eq('service_id', serviceId);
    const { data, error } = await query.order('version', { ascending: false });
    if (error) this.databaseFailure('WORKFLOW_TEMPLATE_LIST_FAILED', error);
    return data ?? [];
  }

  async getTemplate(id: string) {
    const { data, error } = await this.client
      .from('workflow_templates')
      .select(
        '*, stages:workflow_template_stages(*, items:workflow_template_stage_items(*)), stage_deps:workflow_template_stage_dependencies(*), item_deps:workflow_template_item_dependencies(*)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) this.databaseFailure('WORKFLOW_TEMPLATE_LOOKUP_FAILED', error);
    if (!data) {
      throw new NotFoundException({
        code: 'WORKFLOW_TEMPLATE_NOT_FOUND',
        message: 'Workflow template not found.',
      });
    }
    return data;
  }

  async createTemplate(dto: CreateWorkflowTemplateDto, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc('workflow_create_template', {
      p_service_id: dto.serviceId,
      p_name: dto.name,
      p_description: dto.description ?? null,
      p_actor_id: user.profileId,
    });
    if (error) this.databaseFailure('WORKFLOW_CREATE_FAILED', error);
    return data;
  }

  async updateTemplate(
    id: string,
    dto: UpdateWorkflowTemplateDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(id);
    const payload: Record<string, unknown> = { updated_by: user.profileId };
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined) payload.description = dto.description;
    const { data, error } = await this.client
      .from('workflow_templates')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_UPDATE_FAILED', error);
    return data;
  }

  async cloneTemplate(templateId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc('workflow_clone_template', {
      p_template_id: templateId,
      p_actor_id: user.profileId,
    });
    if (error) this.databaseFailure('WORKFLOW_CLONE_FAILED', error);
    return this.getTemplate(String(data));
  }

  async validateTemplateForPublish(
    templateId: string,
  ): Promise<WorkflowPublishValidation> {
    const template = await this.getTemplate(templateId);
    const stages: TemplateStageRow[] = Array.isArray(template.stages)
      ? template.stages
      : [];
    const stageDependencies: StageDependencyRow[] = Array.isArray(
      template.stage_deps,
    )
      ? template.stage_deps
      : [];
    const itemDependencies: ItemDependencyRow[] = Array.isArray(
      template.item_deps,
    )
      ? template.item_deps
      : [];
    const items = stages.flatMap((stage: TemplateStageRow) =>
      Array.isArray(stage.items) ? stage.items : [],
    );
    const errors = new Set<string>();
    const warnings = new Set<string>();

    const { data: deliveryItems, error: deliveryError } = await this.client
      .from('service_delivery_items')
      .select('id,service_id,is_required,active')
      .eq('service_id', template.service_id)
      .eq('active', true);
    if (deliveryError) {
      this.databaseFailure(
        'WORKFLOW_DELIVERY_ITEM_LOOKUP_FAILED',
        deliveryError,
      );
    }

    const serviceItems = deliveryItems ?? [];
    const requiredItems = serviceItems.filter((item) => item.is_required);
    const optionalItems = serviceItems.filter((item) => !item.is_required);
    const mappedIds = items.map((item: TemplateStageItemRow) =>
      String(item.service_delivery_item_id),
    );
    const mappedCounts = new Map<string, number>();
    for (const id of mappedIds) {
      mappedCounts.set(id, (mappedCounts.get(id) ?? 0) + 1);
    }

    if (stages.length === 0) errors.add('NO_STAGES');
    for (const item of requiredItems) {
      if (mappedCounts.get(String(item.id)) !== 1) {
        errors.add('REQUIRED_ITEM_UNMAPPED');
      }
    }

    const stageIds = new Set(
      stages.map((stage: TemplateStageRow) => String(stage.id)),
    );
    const itemIds = new Set(
      items.map((item: TemplateStageItemRow) => String(item.id)),
    );
    const sortOrders = new Set<number>();
    for (const stage of stages) {
      const order = Number(stage.sort_order);
      if (sortOrders.has(order)) errors.add('DUPLICATE_STAGE_SORT_ORDER');
      sortOrders.add(order);
      if (stage.sla_hours !== null && Number(stage.sla_hours) <= 0) {
        errors.add('INVALID_SLA');
      }
    }

    for (const item of items) {
      if (item.sla_hours !== null && Number(item.sla_hours) <= 0) {
        errors.add('INVALID_SLA');
      }
      const validScope = ['internal', 'client', 'both'].includes(
        String(item.approval_scope),
      );
      if (
        (item.completion_mode === 'tasks_done_and_approval' &&
          item.approval_required !== true) ||
        (item.approval_required === true && !validScope)
      ) {
        errors.add('INVALID_APPROVAL_CONFIGURATION');
      }
    }

    if (mappedIds.length > 0) {
      const { data: mappedDeliveryItems, error: mappedError } =
        await this.client
          .from('service_delivery_items')
          .select('id,service_id')
          .in('id', [...new Set(mappedIds)]);
      if (mappedError) {
        this.databaseFailure(
          'WORKFLOW_DELIVERY_ITEM_LOOKUP_FAILED',
          mappedError,
        );
      }
      const mappedServices = new Map(
        (mappedDeliveryItems ?? []).map((item) => [
          String(item.id),
          String(item.service_id),
        ]),
      );
      for (const id of mappedIds) {
        if (mappedServices.get(id) !== String(template.service_id)) {
          errors.add('CROSS_SERVICE_ITEM');
        }
      }
    }

    const normalizedStageDependencies = stageDependencies.map(
      (dependency: StageDependencyRow) => ({
        predecessorStageId: String(dependency.predecessor_stage_id),
        successorStageId: String(dependency.successor_stage_id),
      }),
    );
    for (const dependency of normalizedStageDependencies) {
      if (
        !stageIds.has(dependency.predecessorStageId) ||
        !stageIds.has(dependency.successorStageId)
      ) {
        errors.add('DEPENDENCY_CROSS_TEMPLATE');
      }
      if (dependency.predecessorStageId === dependency.successorStageId) {
        errors.add('STAGE_SELF_DEPENDENCY');
      }
    }
    if (this.validation.detectStageCycles(normalizedStageDependencies)) {
      errors.add('STAGE_DEPENDENCY_CYCLE');
    }

    const normalizedItemDependencies = itemDependencies.map(
      (dependency: ItemDependencyRow) => ({
        predecessorStageItemId: String(dependency.predecessor_stage_item_id),
        successorStageItemId: String(dependency.successor_stage_item_id),
      }),
    );
    for (const dependency of normalizedItemDependencies) {
      if (
        !itemIds.has(dependency.predecessorStageItemId) ||
        !itemIds.has(dependency.successorStageItemId)
      ) {
        errors.add('DEPENDENCY_CROSS_TEMPLATE');
      }
      if (
        dependency.predecessorStageItemId === dependency.successorStageItemId
      ) {
        errors.add('ITEM_SELF_DEPENDENCY');
      }
    }
    if (this.validation.detectItemCycles(normalizedItemDependencies)) {
      errors.add('ITEM_DEPENDENCY_CYCLE');
    }

    const mappedRequiredItems = requiredItems.filter(
      (item) => mappedCounts.get(String(item.id)) === 1,
    ).length;
    const mappedOptionalItems = optionalItems.filter((item) =>
      mappedCounts.has(String(item.id)),
    ).length;
    if (optionalItems.length > mappedOptionalItems) {
      warnings.add('OPTIONAL_ITEMS_UNMAPPED');
    }

    return {
      errors: [...errors],
      warnings: [...warnings],
      stats: {
        stages: stages.length,
        requiredItems: requiredItems.length,
        mappedRequiredItems,
        optionalItems: optionalItems.length,
        mappedOptionalItems,
      },
    };
  }

  async publishTemplate(id: string, user: RequestUser) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(id);
    const validation = await this.validateTemplateForPublish(id);
    if (validation.errors.length > 0) {
      throw new BadRequestException({
        code: 'WORKFLOW_TEMPLATE_INVALID',
        message: 'Workflow template cannot be published.',
        errors: validation.errors,
        warnings: validation.warnings,
        stats: validation.stats,
      });
    }
    const { data, error } = await this.client
      .from('workflow_templates')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user.profileId,
        updated_by: user.profileId,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_PUBLISH_FAILED', error);
    return data;
  }

  async setDefault(id: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_set_default_template',
      { p_template_id: id, p_actor_id: user.profileId },
    );
    if (error) this.databaseFailure('WORKFLOW_SET_DEFAULT_FAILED', error);
    return data;
  }

  async archiveTemplate(id: string, user: RequestUser) {
    this.assertAdmin(user);
    const template = await this.getTemplate(id);
    if (template.status !== 'published') {
      throw new ConflictException({
        code: 'WORKFLOW_ARCHIVE_REQUIRES_PUBLISHED',
        message: 'Only a published template can be archived.',
      });
    }
    const { data, error } = await this.client
      .from('workflow_templates')
      .update({
        status: 'archived',
        is_default: false,
        updated_by: user.profileId,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_ARCHIVE_FAILED', error);
    return data;
  }

  async createStage(
    templateId: string,
    dto: CreateTemplateStageDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(templateId);
    const { data, error } = await this.client
      .from('workflow_template_stages')
      .insert({
        workflow_template_id: templateId,
        name: dto.name,
        description: dto.description ?? null,
        sort_order: dto.sortOrder,
        is_required: dto.isRequired,
        sla_hours: dto.slaHours ?? null,
      })
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_STAGE_CREATE_FAILED', error);
    return data;
  }

  async reorderStages(
    templateId: string,
    dto: ReorderTemplateStagesDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_reorder_template_stages',
      {
        p_template_id: templateId,
        p_stage_ids: dto.stageIds,
        p_actor_id: user.profileId,
      },
    );
    if (error) this.workflowRpcFailure('WORKFLOW_STAGE_REORDER_FAILED', error);
    return data;
  }

  async updateStage(
    stageId: string,
    dto: UpdateTemplateStageDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(await this.templateIdForStage(stageId));
    const payload: Record<string, unknown> = {};
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;
    if (dto.isRequired !== undefined) payload.is_required = dto.isRequired;
    if (dto.slaHours !== undefined) payload.sla_hours = dto.slaHours;
    const { data, error } = await this.client
      .from('workflow_template_stages')
      .update(payload)
      .eq('id', stageId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_STAGE_UPDATE_FAILED', error);
    return data;
  }

  async deleteStage(stageId: string, user: RequestUser) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(await this.templateIdForStage(stageId));
    const { error } = await this.client
      .from('workflow_template_stages')
      .delete()
      .eq('id', stageId);
    if (error) this.databaseFailure('WORKFLOW_STAGE_DELETE_FAILED', error);
    return { success: true };
  }

  async mapItem(stageId: string, dto: MapStageItemDto, user: RequestUser) {
    this.assertAdmin(user);
    const templateId = await this.templateIdForStage(stageId);
    const template = await this.assertDraftTemplate(templateId);
    const { data: deliveryItem, error: itemError } = await this.client
      .from('service_delivery_items')
      .select('id,service_id,delivery_item_code')
      .eq('id', dto.serviceDeliveryItemId)
      .maybeSingle();
    if (itemError) {
      this.databaseFailure('WORKFLOW_DELIVERY_ITEM_LOOKUP_FAILED', itemError);
    }
    if (!deliveryItem) {
      throw new NotFoundException({
        code: 'WORKFLOW_DELIVERY_ITEM_NOT_FOUND',
        message: 'Service delivery item not found.',
      });
    }
    if (String(deliveryItem.service_id) !== String(template.service_id)) {
      throw new BadRequestException({
        code: 'WORKFLOW_CROSS_SERVICE_ITEM',
        message: 'Delivery item belongs to another service.',
      });
    }
    const { data, error } = await this.client
      .from('workflow_template_stage_items')
      .insert({
        workflow_template_stage_id: stageId,
        workflow_template_id: templateId,
        service_delivery_item_id: dto.serviceDeliveryItemId,
        service_delivery_item_code: deliveryItem.delivery_item_code,
        sort_order: dto.sortOrder,
        approval_required: dto.approvalRequired,
        approval_scope: dto.approvalScope,
        sla_hours: dto.slaHours ?? null,
        auto_create_task: dto.autoCreateTask,
        completion_mode: dto.completionMode,
      })
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_ITEM_MAP_FAILED', error);
    return data;
  }

  async updateMappedItem(
    itemId: string,
    dto: UpdateMappedStageItemDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(await this.templateIdForItem(itemId));
    const payload: Record<string, unknown> = {};
    if (dto.sortOrder !== undefined) payload.sort_order = dto.sortOrder;
    if (dto.approvalRequired !== undefined)
      payload.approval_required = dto.approvalRequired;
    if (dto.approvalScope !== undefined)
      payload.approval_scope = dto.approvalScope;
    if (dto.slaHours !== undefined) payload.sla_hours = dto.slaHours;
    if (dto.autoCreateTask !== undefined)
      payload.auto_create_task = dto.autoCreateTask;
    if (dto.completionMode !== undefined)
      payload.completion_mode = dto.completionMode;
    const { data, error } = await this.client
      .from('workflow_template_stage_items')
      .update(payload)
      .eq('id', itemId)
      .select()
      .single();
    if (error) this.databaseFailure('WORKFLOW_ITEM_UPDATE_FAILED', error);
    return data;
  }

  async removeMappedItem(itemId: string, user: RequestUser) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(await this.templateIdForItem(itemId));
    const { error } = await this.client
      .from('workflow_template_stage_items')
      .delete()
      .eq('id', itemId);
    if (error) this.databaseFailure('WORKFLOW_ITEM_DELETE_FAILED', error);
    return { success: true };
  }

  async createStageDependency(
    templateId: string,
    dto: CreateStageDependencyDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_add_stage_dependency',
      {
        p_template_id: templateId,
        p_predecessor_stage_id: dto.predecessorStageId,
        p_successor_stage_id: dto.successorStageId,
        p_lag_hours: dto.lagHours,
        p_actor_id: user.profileId,
      },
    );
    if (error) {
      this.workflowRpcFailure('WORKFLOW_STAGE_DEPENDENCY_CREATE_FAILED', error);
    }
    return data;
  }

  async deleteStageDependency(dependencyId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_delete_stage_dependency',
      {
        p_dependency_id: dependencyId,
        p_actor_id: user.profileId,
      },
    );
    if (error) {
      this.workflowRpcFailure('WORKFLOW_STAGE_DEPENDENCY_DELETE_FAILED', error);
    }
    return data;
  }

  async createItemDependency(
    templateId: string,
    dto: CreateItemDependencyDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_add_item_dependency',
      {
        p_template_id: templateId,
        p_predecessor_stage_item_id: dto.predecessorStageItemId,
        p_successor_stage_item_id: dto.successorStageItemId,
        p_lag_hours: dto.lagHours,
        p_actor_id: user.profileId,
      },
    );
    if (error) {
      this.workflowRpcFailure('WORKFLOW_ITEM_DEPENDENCY_CREATE_FAILED', error);
    }
    return data;
  }

  async deleteItemDependency(dependencyId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc(
      'workflow_delete_item_dependency',
      {
        p_dependency_id: dependencyId,
        p_actor_id: user.profileId,
      },
    );
    if (error) {
      this.workflowRpcFailure('WORKFLOW_ITEM_DEPENDENCY_DELETE_FAILED', error);
    }
    return data;
  }
}
