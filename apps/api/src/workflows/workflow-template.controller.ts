import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateWorkflowTemplateSchema } from './dto/workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('admin/workflows/templates')
@Roles('admin', 'team_leader', 'employee')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class WorkflowTemplateController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  async listTemplates(@Query('serviceId') serviceId?: string) {
    return this.workflowService.listTemplates(serviceId);
  }

  @Get(':id')
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.getTemplate(id);
  }

  @Post()
  @Roles('admin')
  async createTemplate(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateWorkflowTemplateSchema.parse(body);
    return this.workflowService.createTemplate(parsed, user);
  }

  @Post(':id/publish')
  @Roles('admin')
  async publishTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.publishTemplate(id, user);
  }
}
