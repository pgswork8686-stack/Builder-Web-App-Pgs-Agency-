import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateWorkflowTemplateDto } from './dto/workflow.dto';
import { WorkflowValidationService } from './workflow-validation.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly validation: WorkflowValidationService,
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

  async listTemplates(serviceId?: string) {
    let query = this.client
      .from('workflow_templates')
      .select('*, stages:workflow_template_stages(*)');
    if (serviceId) query = query.eq('service_id', serviceId);
    const { data, error } = await query.order('version', { ascending: false });
    if (error) throw new BadRequestException(error.message);
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
    const { count } = await this.client
      .from('workflow_templates')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', dto.serviceId);
    const version = (count || 0) + 1;
    const workflowCode =
      `QTDV_` + String(Math.floor(1000 + Math.random() * 9000));

    const { data, error } = await this.client
      .from('workflow_templates')
      .insert({
        workflow_code: workflowCode,
        service_id: dto.serviceId,
        name: dto.name,
        description: dto.description || null,
        version,
        status: 'draft',
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async publishTemplate(id: string, user: RequestUser) {
    this.assertAdmin(user);
    const template = await this.getTemplate(id);
    if (template.status === 'published') return template;
    if (!template.stages || template.stages.length === 0) {
      throw new BadRequestException('Cannot publish template with 0 stages.');
    }

    const hasCycles = this.validation.detectStageCycles(
      template.stage_deps || [],
    );
    if (hasCycles) {
      throw new BadRequestException({
        code: 'WORKFLOW_DEPENDENCY_CYCLE',
        message: 'Stage dependencies form a cycle.',
      });
    }

    const { data, error } = await this.client
      .from('workflow_templates')
      .update({
        status: 'published',
        published_by: user.profileId,
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
