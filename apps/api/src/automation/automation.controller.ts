import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AutomationExecutionsQuerySchema,
  AutomationManualEventSchema,
  AutomationRuleCreateSchema,
  AutomationRuleQuerySchema,
  AutomationRuleUpdateSchema,
} from './dto/automation.dto';
import { AutomationService } from './automation.service';

@Controller('automation')
@Roles('admin')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('rules')
  async listRules(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = AutomationRuleQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.automationService.listRules(parsed.data, user);
  }

  @Post('rules')
  async createRule(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = AutomationRuleCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.automationService.createRule(parsed.data, user);
  }

  @Patch('rules/:id')
  async updateRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = AutomationRuleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const isPatchEmpty = parsed.error.errors.some(
        (item) => item.message === 'PATCH_EMPTY',
      );
      throw new BadRequestException({
        code: isPatchEmpty ? 'PATCH_EMPTY' : 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.automationService.updateRule(id, parsed.data, user);
  }

  @Get('executions')
  async listExecutions(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = AutomationExecutionsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.automationService.listExecutions(parsed.data, user);
  }

  @Post('events/manual')
  async runManualEvent(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = AutomationManualEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.automationService.runManualEvent(parsed.data, user);
  }

  @Post('run-scheduled')
  async runScheduled(@CurrentUser() user: RequestUser) {
    return this.automationService.runScheduled(user);
  }
}
