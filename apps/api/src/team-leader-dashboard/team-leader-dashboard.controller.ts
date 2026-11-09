import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TeamLeaderDashboardService } from './team-leader-dashboard.service';

@Controller('team-leader/dashboard')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('team_leader')
export class TeamLeaderDashboardController {
  constructor(private readonly service: TeamLeaderDashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.service.getDashboard(user);
  }
}
