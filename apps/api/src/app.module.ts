import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { LeaveModule } from './leave/leave.module';
import { OrganizationModule } from './organization/organization.module';
import { PeopleModule } from './people/people.module';
import { ProjectsModule } from './projects/projects.module';
import { ServicesModule } from './services/services.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    SupabaseModule,
    AuthModule,
    AdminModule,
    OrganizationModule,
    PeopleModule,
    ClientsModule,
    ProjectsModule,
    ServicesModule,
    WorkspaceModule,
    TasksModule,
    AttendanceModule,
    LeaveModule,
    FinanceModule,
  ],
})
export class AppModule {}
