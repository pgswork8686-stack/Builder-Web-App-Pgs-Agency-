import {
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
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateWorkflowTemplateSchema,
  UpdateWorkflowTemplateSchema,
  CreateTemplateStageSchema,
  UpdateTemplateStageSchema,
  MapStageItemSchema,
  CreateStageDependencySchema,
} from './dto/workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('admin/workflows')
@Roles('admin', 'team_leader', 'employee')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class WorkflowTemplateController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('templates')
  async listTemplates(@Query('serviceId') serviceId?: string) {
    return this.workflowService.listTemplates(serviceId);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.getTemplate(id);
  }

  @Post('templates')
  @Roles('admin')
  async createTemplate(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateWorkflowTemplateSchema.parse(body);
    return this.workflowService.createTemplate(parsed, user);
  }

  @Patch('templates/:id')
  @Roles('admin')
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateWorkflowTemplateSchema.parse(body);
    return this.workflowService.updateTemplate(id, parsed, user);
  }

  @Post('templates/:id/clone')
  @Roles('admin')
  async cloneTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.cloneTemplate(id, user);
  }

  @Post('templates/:id/publish')
  @Roles('admin')
  async publishTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.publishTemplate(id, user);
  }

  @Post('templates/:id/set-default')
  @Roles('admin')
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.setDefault(id, user);
  }

  @Post('templates/:id/stages')
  @Roles('admin')
  async createStage(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateTemplateStageSchema.parse(body);
    return this.workflowService.createStage(templateId, parsed, user);
  }

  @Patch('stages/:stageId')
  @Roles('admin')
  async updateStage(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = UpdateTemplateStageSchema.parse(body);
    return this.workflowService.updateStage(stageId, parsed, user);
  }

  @Delete('stages/:stageId')
  @Roles('admin')
  async deleteStage(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.deleteStage(stageId, user);
  }

  @Post('stages/:stageId/items')
  @Roles('admin')
  async mapItem(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = MapStageItemSchema.parse(body);
    return this.workflowService.mapItem(stageId, parsed, user);
  }

  @Delete('stage-items/:itemId')
  @Roles('admin')
  async removeMappedItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.removeMappedItem(itemId, user);
  }

  @Post('templates/:id/stage-dependencies')
  @Roles('admin')
  async createStageDependency(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = CreateStageDependencySchema.parse(body);
    return this.workflowService.createStageDependency(templateId, parsed, user);
  }

  @Delete('stage-dependencies/:id')
  @Roles('admin')
  async deleteStageDependency(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.deleteStageDependency(id, user);
  }
}
