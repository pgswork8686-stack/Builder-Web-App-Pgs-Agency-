import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import { AutomationService } from '../automation/automation.service';
import type {
  CreateWorkflowTemplateDto,
  UpdateWorkflowTemplateDto,
  CreateTemplateStageDto,
  UpdateTemplateStageDto,
  MapStageItemDto,
  CreateStageDependencyDto,
} from './dto/workflow.dto';
import { WorkflowValidationService } from './workflow-validation.service';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly validation: WorkflowValidationService,
    private readonly automation?: AutomationService,
  ) {}

  private get client() {
    return this.supabase.getSystemClient();
  }

  private assertAdmin(user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_OPERATION',
        message: 'Only administrators can manage workflow templates.',
      });
    }
  }

  private async assertDraftTemplate(templateId: string) {
    const { data, error } = await this.client
      .from('workflow_templates')
      .select('id, status, service_id')
      .eq('id', templateId)
      .maybeSingle();
    if (error || !data)
      throw new NotFoundException('Workflow template not found.');
    if (data.status !== 'draft') {
      throw new ConflictException({
        code: 'WORKFLOW_TEMPLATE_IMMUTABLE',
        message:
          'Published or archived workflow templates are immutable. Clone to create a new draft.',
      });
    }
    return data;
  }

  async listTemplates(serviceId?: string) {
    let query = this.client
      .from('workflow_templates')
      .select('*, stages:workflow_template_stages(*)');
    if (serviceId) query = query.eq('service_id', serviceId);
    const { data, error } = await query.order('version', { ascending: false });
    if (error)
      throw new BadRequestException({
        code: 'DB_ERROR',
        message: 'Failed to list templates',
      });
    return data || [];
  }

  async getTemplate(id: string) {
    const { data, error } = await this.client
      .from('workflow_templates')
      .select(
        '*, stages:workflow_template_stages(*, items:workflow_template_stage_items(*)), stage_deps:workflow_template_stage_dependencies(*), item_deps:workflow_template_item_dependencies(*)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !data)
      throw new NotFoundException('Workflow template not found.');
    return data;
  }

  async createTemplate(dto: CreateWorkflowTemplateDto, user: RequestUser) {
    this.assertAdmin(user);
    const { data, error } = await this.client.rpc('workflow_create_template', {
      p_service_id: dto.serviceId,
      p_name: dto.name,
      p_description: dto.description || null,
      p_actor_id: user.profileId,
    });

    if (error) {
      this.logger.error(`Failed to create workflow template: `);
      throw new BadRequestException({
        code: 'WORKFLOW_CREATE_FAILED',
        message: 'Failed to create template',
      });
    }
    return data;
  }

  async updateTemplate(
    id: string,
    dto: UpdateWorkflowTemplateDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(id);
    const { data, error } = await this.client
      .from('workflow_templates')
      .update({
        ...dto,
        updated_by: user.profileId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'UPDATE_FAILED',
        message: 'Failed to update template',
      });
    return data;
  }

  async cloneTemplate(templateId: string, user: RequestUser) {
    this.assertAdmin(user);
    const source = await this.getTemplate(templateId);
    const newTemplate = await this.createTemplate(
      {
        serviceId: source.service_id,
        name: ` (Clone)`,
        description: source.description,
      },
      user,
    );

    const stageMap = new Map<string, string>();
    for (const stage of source.stages || []) {
      const { data: newStage } = await this.client
        .from('workflow_template_stages')
        .insert({
          workflow_template_id: newTemplate.id,
          name: stage.name,
          description: stage.description,
          sort_order: stage.sort_order,
          is_required: stage.is_required,
          sla_hours: stage.sla_hours,
        })
        .select()
        .single();
      if (newStage) stageMap.set(stage.id, newStage.id);
    }
    return newTemplate;
  }

  async publishTemplate(id: string, user: RequestUser) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(id);
    const template = await this.getTemplate(id);
    const stages = template.stages || [];
    if (stages.length === 0) {
      throw new BadRequestException({
        code: 'WORKFLOW_TEMPLATE_INVALID',
        message: 'Workflow must contain at least one stage before publishing.',
        errors: ['NO_STAGES'],
      });
    }
    if (this.validation.detectStageCycles(template.stage_deps || [])) {
      throw new BadRequestException({
        code: 'WORKFLOW_TEMPLATE_INVALID',
        message: 'Workflow contains cyclic dependencies.',
        errors: ['STAGE_DEPENDENCY_CYCLE'],
      });
    }

    const { data, error } = await this.client
      .from('workflow_templates')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user.profileId,
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'PUBLISH_FAILED',
        message: 'Failed to publish template',
      });
    return data;
  }

  async setDefault(id: string, user: RequestUser) {
    this.assertAdmin(user);
    const template = await this.getTemplate(id);
    if (template.status !== 'published') {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Only published templates can be set as default',
      });
    }
    await this.client
      .from('workflow_templates')
      .update({ is_default: false })
      .eq('service_id', template.service_id);

    const { data, error } = await this.client
      .from('workflow_templates')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'SET_DEFAULT_FAILED',
        message: 'Failed to set default',
      });
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
      .insert({ workflow_template_id: templateId, ...dto })
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'STAGE_CREATE_FAILED',
        message: 'Failed to create stage',
      });
    return data;
  }

  async updateStage(
    stageId: string,
    dto: UpdateTemplateStageDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    const { data: stage } = await this.client
      .from('workflow_template_stages')
      .select('workflow_template_id')
      .eq('id', stageId)
      .single();
    if (stage) await this.assertDraftTemplate(stage.workflow_template_id);
    const { data, error } = await this.client
      .from('workflow_template_stages')
      .update(dto)
      .eq('id', stageId)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'STAGE_UPDATE_FAILED',
        message: 'Failed to update stage',
      });
    return data;
  }

  async deleteStage(stageId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data: stage } = await this.client
      .from('workflow_template_stages')
      .select('workflow_template_id')
      .eq('id', stageId)
      .single();
    if (stage) await this.assertDraftTemplate(stage.workflow_template_id);
    await this.client
      .from('workflow_template_stages')
      .delete()
      .eq('id', stageId);
    return { success: true };
  }

  async mapItem(stageId: string, dto: MapStageItemDto, user: RequestUser) {
    this.assertAdmin(user);
    const { data: stage } = await this.client
      .from('workflow_template_stages')
      .select('workflow_template_id')
      .eq('id', stageId)
      .single();
    if (stage) await this.assertDraftTemplate(stage.workflow_template_id);
    const { data, error } = await this.client
      .from('workflow_template_stage_items')
      .insert({
        stage_id: stageId,
        service_delivery_item_id: dto.serviceDeliveryItemId,
        ...dto,
      })
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'MAP_ITEM_FAILED',
        message: 'Failed to map item',
      });
    return data;
  }

  async removeMappedItem(itemId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data: item } = await this.client
      .from('workflow_template_stage_items')
      .select('stage_id')
      .eq('id', itemId)
      .single();
    if (item?.stage_id) {
      const { data: stage } = await this.client
        .from('workflow_template_stages')
        .select('workflow_template_id')
        .eq('id', item.stage_id)
        .single();
      if (stage) await this.assertDraftTemplate(stage.workflow_template_id);
    }
    await this.client
      .from('workflow_template_stage_items')
      .delete()
      .eq('id', itemId);
    return { success: true };
  }

  async createStageDependency(
    templateId: string,
    dto: CreateStageDependencyDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);
    await this.assertDraftTemplate(templateId);
    const { data, error } = await this.client
      .from('workflow_template_stage_dependencies')
      .insert({ workflow_template_id: templateId, ...dto })
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'STAGE_DEP_FAILED',
        message: 'Failed to create stage dependency',
      });
    return data;
  }

  async deleteStageDependency(dependencyId: string, user: RequestUser) {
    this.assertAdmin(user);
    const { data: dep } = await this.client
      .from('workflow_template_stage_dependencies')
      .select('workflow_template_id')
      .eq('id', dependencyId)
      .single();
    if (dep) await this.assertDraftTemplate(dep.workflow_template_id);
    await this.client
      .from('workflow_template_stage_dependencies')
      .delete()
      .eq('id', dependencyId);
    return { success: true };
  }
}