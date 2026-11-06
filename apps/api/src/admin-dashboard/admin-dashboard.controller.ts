import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class AdminDashboardController {
  constructor(private readonly service: AdminDashboardService) {}

  @Get()
  getDashboard() {
    return this.service.getDashboard();
  }
}
