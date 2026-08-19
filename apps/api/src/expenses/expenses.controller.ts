import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseSchema,
  ExpenseQuerySchema,
  ReviewExpenseSchema,
} from './dto/expense.dto';

@Controller('expenses')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async list(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = ExpenseQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.expensesService.listExpenses(result.data, user);
  }

  @Get(':id')
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.getExpenseById(id, user);
  }

  @Post()
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async create(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateExpenseSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.expensesService.createExpense(result.data, user);
  }

  @Post(':id/review')
  @Roles('admin', 'accountant')
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = ReviewExpenseSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.expensesService.reviewExpense(id, result.data, user);
  }

  @Post(':id/reimburse')
  @Roles('admin', 'accountant')
  async reimburse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.reimburseExpense(id, user);
  }
}
