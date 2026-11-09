import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmployeeDashboardService } from './employee-dashboard.service';

@Controller('employee/dashboard')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('employee')
export class EmployeeDashboardController {
  constructor(private readonly service: EmployeeDashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.service.getDashboard(user);
  }
}
