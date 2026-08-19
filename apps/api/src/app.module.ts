import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.throttleTtl,
          limit: config.throttleLimit,
        },
      ],
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
