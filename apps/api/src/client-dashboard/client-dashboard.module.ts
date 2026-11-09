import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ClientDashboardController } from './client-dashboard.controller';
import { ClientDashboardService } from './client-dashboard.service';

@Module({
  imports: [SupabaseModule, ConfigModule, AuthModule],
  controllers: [ClientDashboardController],
  providers: [ClientDashboardService],
})
export class ClientDashboardModule {}
