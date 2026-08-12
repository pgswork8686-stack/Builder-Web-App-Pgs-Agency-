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
import type { RequestUser } from '../auth/auth.types';
import { AttendanceService } from './attendance.service';
import {
  CheckInSchema,
  CheckOutSchema,
  AttendanceSignedUploadSchema,
  AttendanceQuerySchema,
  AttendanceAdjustmentSchema,
} from './dto/attendance.dto';

@Controller('attendance')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  async checkIn(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = CheckInSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.attendanceService.checkIn(result.data, user);
  }

  @Post('check-out')
  async checkOut(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = CheckOutSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.attendanceService.checkOut(result.data, user);
  }

  @Get('me')
  async getMyHistory(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = AttendanceQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.attendanceService.getMyHistory(result.data, user);
  }

  @Get('directory')
  async getDirectory(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = AttendanceQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.attendanceService.getDirectory(result.data, user);
  }

  @Post('records/:id/adjust')
  async adjustRecord(
    @Param('id') recordId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = AttendanceAdjustmentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.attendanceService.adjustRecord(recordId, result.data, user);
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getSummary(user);
  }

  @Post('signed-upload')
  async getPhotoUploadSignature(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = AttendanceSignedUploadSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((error) => error.message).join(', '),
      );
    }
    return this.attendanceService.getPhotoUploadSignature(
      result.data.fileName,
      result.data.mimeType,
      result.data.fileSize,
      user,
    );
  }
}
