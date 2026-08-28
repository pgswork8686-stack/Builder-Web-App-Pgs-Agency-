import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { AutomationModule } from './automation/automation.module';
import { ChatModule } from './chat/chat.module';
import { ClientsModule } from './clients/clients.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { DocumentsModule } from './documents/documents.module';
import { ExpensesModule } from './expenses/expenses.module';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { LeaveModule } from './leave/leave.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationModule } from './organization/organization.module';
import { PayrollModule } from './payroll/payroll.module';
import { PeopleModule } from './people/people.module';
import { ProjectsModule } from './projects/projects.module';
import { ServicesModule } from './services/services.module';
import { SettingsModule } from './settings/settings.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SupportModule } from './support/support.module';
import { TasksModule } from './tasks/tasks.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WorkCalendarModule } from './work-calendar/work-calendar.module';
import { WorkflowModule } from './workflows/workflow.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import {
  resolveClientIp,
  type ClientIpRequest,
} from './common/network/client-ip';

export function createThrottlerOptions(
  config: Pick<ConfigService, 'throttleTtl' | 'throttleLimit' | 'trustProxy'>,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: config.throttleTtl,
        limit: config.throttleLimit,
      },
    ],
    getTracker: (request) =>
      resolveClientIp(request as ClientIpRequest, config.trustProxy),
  };
}

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createThrottlerOptions,
    }),
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
    ExpensesModule,
    PayrollModule,
    DocumentsModule,
    SupportModule,
    SettingsModule,
    NotificationsModule,
    ChatModule,
    AutomationModule,
    WorkCalendarModule,
    WorkflowModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
