import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AggregateTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    SupabaseModule,
    WorkspaceModule,
    NotificationsModule,
    AutomationModule,
  ],
  controllers: [AggregateTasksController, TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
