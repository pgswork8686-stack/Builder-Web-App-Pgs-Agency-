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
  NotificationListQuerySchema,
  NotificationPreferencesUpdateSchema,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = NotificationListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.notificationsService.list(parsed.data, user);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.markRead(id, user);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch('preferences')
  async updatePreferences(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = NotificationPreferencesUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const isPatchEmpty = parsed.error.errors.some(
        (item) => item.message === 'PATCH_EMPTY',
      );
      throw new BadRequestException({
        code: isPatchEmpty ? 'PATCH_EMPTY' : 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.notificationsService.updatePreferences(parsed.data, user);
  }
}
