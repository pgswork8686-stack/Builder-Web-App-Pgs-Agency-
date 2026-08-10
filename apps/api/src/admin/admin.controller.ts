import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { ApproveUserDto } from './dto/approve-user.dto';
import { RejectUserDto } from './dto/reject-user.dto';

@Controller('admin/users')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pending')
  async getPendingUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getPendingUsers(pageNum, limitNum);
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.OK)
  async approveUser(
    @Param('userId') userId: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.adminService.approveUser(adminUserId, userId, dto.role);
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectUser(
    @Param('userId') userId: string,
    @Body() dto: RejectUserDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.adminService.rejectUser(adminUserId, userId, dto?.reason);
  }
}
