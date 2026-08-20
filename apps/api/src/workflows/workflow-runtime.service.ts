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
import { TasksService } from '../tasks/tasks.service';
import { AutomationService } from '../automation/automation.service';
import { WorkflowSlaService } from './workflow-sla.service';

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

  async getProjectWorkflows(projectId: string) {
    const { data, error } = await this.client
      .from('project_workflows')
      .select(
        '*, stages:project_workflow_stages(*, items:project_workflow_stage_items(*))',
      )
      .eq('project_id', projectId);
    if (error)
      throw new BadRequestException({
        code: 'DB_ERROR',
        message: 'Failed to get workflows',
      });
    return data || [];
  }

  async instantiateProjectServiceWorkflow(
    projectId: string,
    projectServiceId: string,
  ) {
    const { data: existing } = await this.client
      .from('project_workflows')
      .select('id')
      .eq('project_service_id', projectServiceId)
      .maybeSingle();
    if (existing)
      return { instantiated: true, workflowId: existing.id, isExisting: true };

    const { data: projService } = await this.client
      .from('project_services')
      .select('id, service_id')
      .eq('id', projectServiceId)
      .single();
    if (!projService) throw new NotFoundException('Project service not found');

    const { data: template } = await this.client
      .from('workflow_templates')
      .select(
        '*, stages:workflow_template_stages(*, items:workflow_template_stage_items(*)), stage_deps:workflow_template_stage_dependencies(*)',
      )
      .eq('service_id', projService.service_id)
      .eq('status', 'published')
      .eq('is_default', true)
      .maybeSingle();
    if (!template) {
      return { instantiated: false, reason: 'no_default_workflow' };
    }

    const { data: pw, error: pwErr } = await this.client
      .from('project_workflows')
      .insert({
        project_id: projectId,
        project_service_id: projectServiceId,
        source_workflow_template_id: template.id,
        source_workflow_code: template.workflow_code,
        source_workflow_version: template.version,
        name: template.name,
        status: 'not_started',
      })
      .select()
      .single();
    if (pwErr)
      throw new BadRequestException({
        code: 'INSTANTIATE_FAILED',
        message: pwErr.message,
      });

    const stageMap = new Map<string, string>();
    for (const stage of template.stages || []) {
      const { data: ps } = await this.client
        .from('project_workflow_stages')
        .insert({
          project_workflow_id: pw.id,
          source_stage_id: stage.id,
          name: stage.name,
          description: stage.description,
          sort_order: stage.sort_order,
          is_required: stage.is_required,
          status: 'locked',
          sla_hours: stage.sla_hours,
        })
        .select()
        .single();
      if (ps) stageMap.set(stage.id, ps.id);
    }

    const hasIncomingDep = new Set(
      (template.stage_deps || []).map((d: any) =>
        stageMap.get(d.successor_stage_id as string),
      ),
    );
    for (const psId of stageMap.values()) {
      if (!hasIncomingDep.has(psId)) {
        await this.client
          .from('project_workflow_stages')
          .update({ status: 'ready' })
          .eq('id', psId);
      }
    }

    return { instantiated: true, workflowId: pw.id, isExisting: false };
  }

  async startWorkflow(workflowId: string) {
    const { data, error } = await this.client
      .from('project_workflows')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'START_FAILED',
        message: 'Failed to start workflow',
      });
    return data;
  }

  async startStage(stageId: string) {
    const { data: stage } = await this.client
      .from('project_workflow_stages')
      .select('*')
      .eq('id', stageId)
      .single();
    if (!stage) throw new NotFoundException('Stage not found');
    if (stage.status === 'locked') {
      throw new ConflictException({
        code: 'WORKFLOW_DEPENDENCY_BLOCKED',
        message:
          'Predecessor stages must be completed before starting this stage.',
      });
    }

    const { data, error } = await this.client
      .from('project_workflow_stages')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', stageId)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'STAGE_START_FAILED',
        message: 'Failed to start stage',
      });
    return data;
  }

  async completeStage(stageId: string) {
    const { data, error } = await this.client
      .from('project_workflow_stages')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', stageId)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'STAGE_COMPLETE_FAILED',
        message: 'Failed to complete stage',
      });
    return data;
  }

  async overrideDependency(
    dependencyId: string,
    reason: string,
    user: RequestUser,
  ) {
    if (user.role !== 'admin' && user.role !== 'team_leader') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only admins or managers can override dependencies',
      });
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({
        code: 'INVALID_REASON',
        message: 'Reason must be at least 3 characters',
      });
    }
    const { data, error } = await this.client
      .from('project_workflow_stage_dependencies')
      .update({
        overridden_at: new Date().toISOString(),
        overridden_by: user.profileId,
        override_reason: reason.trim(),
      })
      .eq('id', dependencyId)
      .select()
      .single();
    if (error)
      throw new BadRequestException({
        code: 'OVERRIDE_FAILED',
        message: 'Failed to override dependency',
      });
    return data;
  }
}
