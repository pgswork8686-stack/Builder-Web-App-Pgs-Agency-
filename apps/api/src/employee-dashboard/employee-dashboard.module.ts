import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmployeeDashboardController } from './employee-dashboard.controller';
import { EmployeeDashboardService } from './employee-dashboard.service';

@Module({
  imports: [SupabaseModule, ConfigModule, AuthModule],
  controllers: [EmployeeDashboardController],
  providers: [EmployeeDashboardService],
})
export class EmployeeDashboardModule {}
