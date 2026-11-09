import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AccountantDashboardController } from './accountant-dashboard.controller';
import { AccountantDashboardService } from './accountant-dashboard.service';

@Module({
  imports: [SupabaseModule, ConfigModule, AuthModule],
  controllers: [AccountantDashboardController],
  providers: [AccountantDashboardService],
})
export class AccountantDashboardModule {}
