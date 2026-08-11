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
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { ApproveUserSchema } from './dto/approve-user.dto';
import { RejectUserSchema } from './dto/reject-user.dto';

@Controller('admin/users')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pending')
  async getPendingUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException(
        'Query parameter "page" must be a positive integer >= 1',
      );
    }

    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > 100) {
      throw new BadRequestException(
        'Query parameter "pageSize" must be an integer between 1 and 100',
      );
    }

    return this.adminService.getPendingUsers(pageNum, sizeNum);
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.OK)
  async approveUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = ApproveUserSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.adminService.approveUser(adminUserId, userId, result.data.role);
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = RejectUserSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.adminService.rejectUser(
      adminUserId,
      userId,
      result.data.reason,
    );
  }
}
