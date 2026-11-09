import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientDashboardService } from './client-dashboard.service';

@Controller('client/dashboard')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('client')
export class ClientDashboardController {
  constructor(private readonly service: ClientDashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.service.getDashboard(user);
  }
}
