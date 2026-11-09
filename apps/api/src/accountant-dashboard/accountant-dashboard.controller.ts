import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccountantDashboardService } from './accountant-dashboard.service';

@Controller('accountant/dashboard')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('accountant')
export class AccountantDashboardController {
  constructor(private readonly service: AccountantDashboardService) {}

  @Get()
  getDashboard() {
    return this.service.getDashboard();
  }
}
