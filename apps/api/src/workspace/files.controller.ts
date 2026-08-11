import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  FileListQuerySchema,
  FinalizeFileSchema,
  UploadRequestSchema,
} from './dto/workspace.dto';
import { FilesService } from './files.service';

function invalidRequest(error: z.ZodError): never {
  throw new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: error.errors.map((item) => item.message).join(', '),
  });
}

@Controller('projects/:projectId')
@Roles('admin', 'team_leader', 'employee', 'accountant', 'client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  private parseList(query: Record<string, string>) {
    const parsed = FileListQuerySchema.safeParse(query);
    if (!parsed.success) invalidRequest(parsed.error);
    return parsed.data;
  }

  private parseUpload(body: unknown) {
    const parsed = UploadRequestSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return parsed.data;
  }

  private parseFinalize(body: unknown) {
    const parsed = FinalizeFileSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return parsed.data;
  }

  @Get('files')
  listProjectFiles(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.list(projectId, this.parseList(query), user);
  }

  @Post('files/upload-request')
  requestProjectUpload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.createUploadRequest(
      projectId,
      this.parseUpload(body),
      user,
    );
  }

  @Post('files/finalize')
  finalizeProjectUpload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.finalize(
      projectId,
      this.parseFinalize(body),
      user,
    );
  }

  @Get('files/:fileId/download')
  download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.download(projectId, fileId, user);
  }

  @Delete('files/:fileId')
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.remove(projectId, fileId, user);
  }

  @Get('tasks/:taskId/files')
  listTaskFiles(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.list(
      projectId,
      this.parseList(query),
      user,
      taskId,
    );
  }

  @Post('tasks/:taskId/files/upload-request')
  requestTaskUpload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.createUploadRequest(
      projectId,
      this.parseUpload(body),
      user,
      taskId,
    );
  }

  @Post('tasks/:taskId/files/finalize')
  finalizeTaskUpload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.filesService.finalize(
      projectId,
      this.parseFinalize(body),
      user,
      taskId,
    );
  }
}
