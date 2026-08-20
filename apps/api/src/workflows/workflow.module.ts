import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { WorkflowTemplateController } from './workflow-template.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowSlaService } from './workflow-sla.service';
import { WorkflowValidationService } from './workflow-validation.service';

@Module({
  imports: [SupabaseModule, WorkCalendarModule],
  controllers: [WorkflowTemplateController],
  providers: [WorkflowService, WorkflowValidationService, WorkflowSlaService],
  exports: [WorkflowService, WorkflowValidationService, WorkflowSlaService],
})
export class WorkflowModule {}
