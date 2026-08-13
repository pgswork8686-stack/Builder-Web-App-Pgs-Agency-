import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatAccessService } from './chat-access.service';
import { ChatController } from './chat.controller';
import { ChatRealtimeGateway } from './chat-realtime.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [SupabaseModule, NotificationsModule, AutomationModule],
  controllers: [ChatController],
  providers: [ChatAccessService, ChatRealtimeGateway, ChatService],
  exports: [ChatAccessService, ChatRealtimeGateway, ChatService],
})
export class ChatModule {}
