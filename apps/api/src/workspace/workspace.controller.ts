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
import { z } from 'zod';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  BoardQuerySchema,
  CalendarQuerySchema,
  MoveTaskSchema,
} from './dto/workspace.dto';
import { WorkspaceService } from './workspace.service';

function invalidRequest(error: z.ZodError): never {
  const messages = error.errors.map((item) => item.message);
  const calendarCode = messages.find((message) =>
    ['CALENDAR_INVALID_RANGE', 'CALENDAR_RANGE_TOO_LARGE'].includes(message),
  );
  throw new BadRequestException({
    code: calendarCode ?? 'VALIDATION_FAILED',
    message: messages.join(', '),
  });
}

@Controller('projects/:projectId')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('board')
  getBoard(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = BoardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.workspaceService.getBoard(projectId, parsed.data, user);
  }

  @Get('calendar')
  getCalendar(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CalendarQuerySchema.safeParse(rawQuery);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.workspaceService.getCalendar(projectId, parsed.data, user);
  }

  @Post('tasks/:taskId/move')
  moveTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = MoveTaskSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.workspaceService.moveTask(projectId, taskId, parsed.data, user);
  }
}
