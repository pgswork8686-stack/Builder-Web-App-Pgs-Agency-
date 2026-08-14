import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRealtimeGateway } from './workspace-realtime.gateway';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [SupabaseModule, NotificationsModule, AutomationModule],
  controllers: [WorkspaceController, CommentsController, FilesController],
  providers: [
    WorkspaceAccessService,
    WorkspaceRealtimeGateway,
    WorkspaceService,
    CommentsService,
    FilesService,
  ],
  exports: [WorkspaceAccessService, WorkspaceRealtimeGateway],
})
export class WorkspaceModule {}
