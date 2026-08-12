import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LeaveService } from './leave.service';
import {
  LeaveRequestCreateSchema,
  LeaveReviewSchema,
  LeaveBalanceAdjustmentSchema,
  LeaveQuerySchema,
} from './dto/leave.dto';

@Controller('leave')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('types')
  async getLeaveTypes(@CurrentUser() user: any) {
    return this.leaveService.getLeaveTypes(user);
  }

  @Post('requests')
  async createRequest(@Body() body: unknown, @CurrentUser() user: any) {
    const result = LeaveRequestCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.leaveService.createRequest(result.data, user);
  }

  @Get('me/requests')
  async getMyRequests(@Query() rawQuery: unknown, @CurrentUser() user: any) {
    const result = LeaveQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.leaveService.getMyRequests(result.data, user);
  }

  @Get('me/balances')
  async getMyBalances(@CurrentUser() user: any) {
    return this.leaveService.getMyBalances(user);
  }

  @Get('directory')
  async getDirectory(@Query() rawQuery: unknown, @CurrentUser() user: any) {
    const result = LeaveQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.leaveService.getDirectory(result.data, user);
  }

  @Post('requests/:id/review')
  async reviewRequest(
    @Param('id') requestId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    const result = LeaveReviewSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.leaveService.reviewRequest(requestId, result.data, user);
  }

  @Post('requests/:id/cancel')
  async cancelRequest(
    @Param('id') requestId: string,
    @CurrentUser() user: any,
  ) {
    return this.leaveService.cancelRequest(requestId, user);
  }

  @Post('balances/:id/adjust')
  async adjustBalance(
    @Param('id') balanceId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    const result = LeaveBalanceAdjustmentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.leaveService.adjustBalance(balanceId, result.data, user);
  }

  @Get('calendar')
  async getCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: any,
  ) {
    return this.leaveService.getCalendar(from, to, user);
  }
}
