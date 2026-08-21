import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { TasksModule } from '../tasks/tasks.module';
import { AutomationModule } from '../automation/automation.module';
import { WorkflowTemplateController } from './workflow-template.controller';
import { WorkflowRuntimeController } from './workflow-runtime.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { WorkflowSlaService } from './workflow-sla.service';
import { WorkflowValidationService } from './workflow-validation.service';

@Module({
  imports: [
    SupabaseModule,
    WorkCalendarModule,
    forwardRef(() => TasksModule),
    forwardRef(() => AutomationModule),
  ],
  controllers: [WorkflowTemplateController, WorkflowRuntimeController],
  providers: [
    WorkflowService,
    WorkflowRuntimeService,
    WorkflowValidationService,
    WorkflowSlaService,
  ],
  exports: [
    WorkflowService,
    WorkflowRuntimeService,
    WorkflowValidationService,
    WorkflowSlaService,
  ],
})
export class WorkflowModule {}
