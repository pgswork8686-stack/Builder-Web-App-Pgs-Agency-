import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ActiveAccountGuard } from './active-account.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionGuard } from './permission.guard';
import { RolesGuard } from './roles.guard';
import { ScopeGuard } from './scope.guard';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    ActiveAccountGuard,
    RolesGuard,
    PermissionGuard,
    ScopeGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
    ActiveAccountGuard,
    RolesGuard,
    PermissionGuard,
    ScopeGuard,
  ],
})
export class AuthModule {}
