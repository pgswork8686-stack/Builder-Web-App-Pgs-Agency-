import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';
import {
  BulkUpdateSettingsSchema,
  UpdateSystemSettingSchema,
} from './dto/settings.dto';

@Controller('admin/settings')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('admin')
  async getAll(@CurrentUser() user: RequestUser) {
    return this.settingsService.getAllSettings(user);
  }

  @Post()
  @Roles('admin')
  async updateSingle(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = UpdateSystemSettingSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.settingsService.updateSetting(result.data, user);
  }

  @Patch('bulk')
  @Roles('admin')
  async bulkUpdate(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = BulkUpdateSettingsSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.settingsService.bulkUpdateSettings(result.data, user);
  }
}
