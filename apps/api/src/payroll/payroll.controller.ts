import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PayrollService } from './payroll.service';
import {
  CreateCompensationRevisionSchema,
  GeneratePayrollRunSchema,
  PayrollRunQuerySchema,
  UpsertEmployeeCompensationSchema,
  UpsertMonthlyPayrollReviewSchema,
} from './dto/payroll.dto';

@Controller('payroll')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('runs')
  @Roles('admin', 'accountant')
  async listRuns(@Query() rawQuery: unknown, @CurrentUser() user: RequestUser) {
    const result = PayrollRunQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.payrollService.listPayrollRuns(result.data, user);
  }

  @Get('runs/:id')
  @Roles('admin', 'accountant')
  async getRunById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.payrollService.getPayrollRunById(id, user);
  }

  @Get('compensations')
  @Roles('admin', 'accountant')
  async listCompensations(@CurrentUser() user: RequestUser) {
    return this.payrollService.listEmployeeCompensations(user);
  }

  @Get('compensations/:userId/history')
  @Roles('admin', 'accountant')
  async getCompensationHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.payrollService.getEmployeeCompensationHistory(userId, user);
  }

  @Post('compensations/:userId/revisions')
  @Roles('admin', 'accountant')
  async createCompensationRevision(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateCompensationRevisionSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }

    return this.payrollService.createEmployeeCompensationRevision(
      userId,
      result.data,
      user,
    );
  }

  @Put('compensations/:userId')
  @Roles('admin', 'accountant')
  async upsertCompensation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpsertEmployeeCompensationSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }

    return this.payrollService.upsertEmployeeCompensation(
      userId,
      result.data,
      user,
    );
  }

  @Get('monthly-reviews')
  @Roles('admin', 'accountant')
  async listMonthlyReviews(
    @Query('periodMonth') periodMonth: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new BadRequestException('periodMonth phải theo định dạng YYYY-MM.');
    }
    return this.payrollService.listMonthlyPayrollReviews(periodMonth, user);
  }

  @Put('monthly-reviews/:userId')
  @Roles('admin', 'accountant')
  async upsertMonthlyReview(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('periodMonth') periodMonth: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new BadRequestException('periodMonth phải theo định dạng YYYY-MM.');
    }
    const result = UpsertMonthlyPayrollReviewSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }

    return this.payrollService.upsertMonthlyPayrollReview(
      userId,
      periodMonth,
      result.data,
      user,
    );
  }

  @Post('runs/generate')
  @Roles('admin', 'accountant')
  async generateRun(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = GeneratePayrollRunSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.payrollService.generatePayrollRun(result.data, user);
  }

  @Post('runs/:id/approve')
  @Roles('admin', 'accountant')
  async approveRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.payrollService.approvePayrollRun(id, user);
  }

  @Post('runs/:id/pay')
  @Roles('admin', 'accountant')
  async payRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.payrollService.markPayrollPaid(id, user);
  }

  @Get('me/payslips')
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async getMyPayslips(@CurrentUser() user: RequestUser) {
    return this.payrollService.getMyPayslips(user);
  }
}
