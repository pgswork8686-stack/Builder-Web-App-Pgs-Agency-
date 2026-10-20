import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { HandoverService } from './handover.service';

const ClientHandoverQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    projectId: z.string().uuid().optional(),
  })
  .strict();

/** Internal side: managers mark a project file as handed over to the client. */
@Controller('projects/:projectId/files/:fileId/handover')
@Roles('admin', 'team_leader', 'employee')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ProjectHandoverController {
  constructor(private readonly handover: HandoverService) {}

  @Patch()
  set(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.handover.setHandover(
      projectId,
      fileId,
      HandoverService.parseClientVisible(body),
      user,
    );
  }
}

/** Client side: only handed-over files of the client's own company. */
@Controller('client/me/handover')
@Roles('client')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ClientHandoverController {
  constructor(private readonly handover: HandoverService) {}

  @Get()
  list(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = ClientHandoverQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.handover.listForClient(user, parsed.data);
  }

  @Get(':fileId/download')
  download(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.handover.downloadForClient(fileId, user);
  }
}
