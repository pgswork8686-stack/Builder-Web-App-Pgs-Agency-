import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { RequestUser } from '../auth/auth.types';
import {
  CreateWorkCalendarEventSchema,
  SyncHolidaysDtoSchema,
  UpdateWorkCalendarEventSchema,
  UpdateWorkCalendarSettingsSchema,
  WorkCalendarRangeQuerySchema,
} from './dto/work-calendar.dto';
import { WorkCalendarService } from './work-calendar.service';

@Controller()
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class WorkCalendarController {
  constructor(private readonly workCalendarService: WorkCalendarService) {}

  /**
   * GET /work-calendar?from=2026-08-01&to=2026-08-31
   * Internal users (admin, team_leader, employee, accountant)
   */
  @Get('work-calendar')
  @Roles('admin', 'team_leader', 'employee', 'accountant')
  async getCalendar(@Query() query: unknown, @CurrentUser() user: RequestUser) {
    const parsed = WorkCalendarRangeQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.workCalendarService.getCalendarRange(
      parsed.data.from,
      parsed.data.to,
      user,
    );
  }

  /**
   * GET /admin/work-calendar/settings
   * Admin only
   */
  @Get('admin/work-calendar/settings')
  @Roles('admin')
  async getAdminSettings() {
    return this.workCalendarService.getSettings();
  }

  /**
   * PATCH /admin/work-calendar/settings
   * Admin only
   */
  @Patch('admin/work-calendar/settings')
  @Roles('admin')
  async updateAdminSettings(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateWorkCalendarSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.workCalendarService.updateSettings(parsed.data, user);
  }

  /**
   * GET /admin/work-calendar/events?from=&to=
   * Admin only
   */
  @Get('admin/work-calendar/events')
  @Roles('admin')
  async getAdminEvents(@Query('from') from?: string, @Query('to') to?: string) {
    return this.workCalendarService.getEvents(from, to);
  }

  /**
   * POST /admin/work-calendar/events
   * Admin only
   */
  @Post('admin/work-calendar/events')
  @Roles('admin')
  async createAdminEvent(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateWorkCalendarEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.workCalendarService.createEvent(parsed.data, user);
  }

  /**
   * PATCH /admin/work-calendar/events/:eventId
   * Admin only
   */
  @Patch('admin/work-calendar/events/:eventId')
  @Roles('admin')
  async updateAdminEvent(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateWorkCalendarEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.workCalendarService.updateEvent(eventId, parsed.data, user);
  }

  /**
   * DELETE /admin/work-calendar/events/:eventId
   * Admin only
   */
  @Delete('admin/work-calendar/events/:eventId')
  @Roles('admin')
  async deleteAdminEvent(
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workCalendarService.deleteEvent(eventId, user);
  }

  /**
   * POST /admin/work-calendar/sync-holidays
   * Admin only
   */
  @Post('admin/work-calendar/sync-holidays')
  @Roles('admin')
  async syncHolidays(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = SyncHolidaysDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.workCalendarService.syncHolidays(parsed.data, user);
  }
}
