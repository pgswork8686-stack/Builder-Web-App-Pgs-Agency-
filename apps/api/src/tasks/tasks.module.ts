import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [SupabaseModule, WorkspaceModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
