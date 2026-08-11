import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ActiveAccountGuard } from './active-account.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, ActiveAccountGuard, RolesGuard],
  exports: [AuthService, AuthGuard, ActiveAccountGuard, RolesGuard],
})
export class AuthModule {}
