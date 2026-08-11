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
  CreateTaskSchema,
  TaskListQuerySchema,
  UpdateTaskSchema,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = TaskListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.tasksService.getTasks(projectId, parsed.data, user);
  }

  @Post()
  async createTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.tasksService.createTask(projectId, parsed.data, user);
  }

  @Get(':taskId')
  async getTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.getTask(projectId, taskId, user);
  }

  @Patch(':taskId')
  async updateTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.tasksService.updateTask(projectId, taskId, parsed.data, user);
  }
}
