import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkCalendarController } from './work-calendar.controller';
import { WorkCalendarService } from './work-calendar.service';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [WorkCalendarController],
  providers: [WorkCalendarService],
  exports: [WorkCalendarService],
})
export class WorkCalendarModule {}
