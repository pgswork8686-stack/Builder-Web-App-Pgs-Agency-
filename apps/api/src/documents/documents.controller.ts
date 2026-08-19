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
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentUploadSessionSchema,
  DocumentQuerySchema,
  FinalizeDocumentSchema,
} from './dto/document.dto';

@Controller('documents')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles('admin', 'accountant', 'team_leader', 'employee', 'client')
  async list(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = DocumentQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.documentsService.listDocuments(result.data, user);
  }

  @Post('upload-session')
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async createUploadSession(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateDocumentUploadSessionSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.documentsService.createUploadSession(result.data, user);
  }

  @Post('finalize')
  @Roles('admin', 'accountant', 'team_leader', 'employee')
  async finalize(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = FinalizeDocumentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.documentsService.finalizeDocument(result.data, user);
  }

  @Get(':id/download')
  @Roles('admin', 'accountant', 'team_leader', 'employee', 'client')
  async getDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentsService.getDownloadUrl(id, user);
  }

  @Delete(':id')
  @Roles('admin', 'team_leader', 'employee')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentsService.removeDocument(id, user);
  }
}
