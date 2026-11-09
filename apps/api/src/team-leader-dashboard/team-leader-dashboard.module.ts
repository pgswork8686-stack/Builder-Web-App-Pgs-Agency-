import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TeamLeaderDashboardController } from './team-leader-dashboard.controller';
import { TeamLeaderDashboardService } from './team-leader-dashboard.service';

@Module({
  imports: [SupabaseModule, ConfigModule, AuthModule],
  controllers: [TeamLeaderDashboardController],
  providers: [TeamLeaderDashboardService],
})
export class TeamLeaderDashboardModule {}
