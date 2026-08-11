import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CommentsService } from './comments.service';
import {
  CommentPaginationSchema,
  CreateCommentSchema,
  UpdateCommentSchema,
} from './dto/workspace.dto';

function invalidRequest(error: z.ZodError): never {
  throw new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: error.errors.map((item) => item.message).join(', '),
  });
}

@Controller('projects/:projectId/tasks/:taskId/comments')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CommentPaginationSchema.safeParse(query);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.commentsService.list(projectId, taskId, parsed.data, user);
  }

  @Post()
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateCommentSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.commentsService.create(projectId, taskId, parsed.data, user);
  }

  @Patch(':commentId')
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateCommentSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.commentsService.update(
      projectId,
      taskId,
      commentId,
      parsed.data,
      user,
    );
  }

  @Delete(':commentId')
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commentsService.remove(projectId, taskId, commentId, user);
  }
}
