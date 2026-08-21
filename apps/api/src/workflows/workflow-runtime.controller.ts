import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import {
  CreateApprovalRequestSchema,
  OverrideDependencySchema,
  RespondApprovalSchema,
} from './dto/workflow.dto';
import { WorkflowRuntimeService } from './workflow-runtime.service';

function parseBody<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid workflow request.',
      issues: result.error.issues,
    });
  }
  return result.data;
}

@Controller('projects/:projectId/workflows')
@UseGuards(AuthGuard, ActiveAccountGuard)
export class WorkflowRuntimeController {
  constructor(private readonly runtime: WorkflowRuntimeService) {}

  @Get()
  getProjectWorkflows(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.getProjectWorkflows(projectId, user);
  }

  @Post('project-services/:projectServiceId/instantiate')
  instantiateWorkflow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('projectServiceId', ParseUUIDPipe) projectServiceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.instantiateProjectServiceWorkflow(
      projectId,
      projectServiceId,
      user,
    );
  }

  @Post(':workflowId/start')
  startWorkflow(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.startWorkflow(projectId, workflowId, user);
  }

  @Post('stages/:stageId/start')
  startStage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.startStage(projectId, stageId, user);
  }

  @Post('stages/:stageId/complete')
  completeStage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.completeStage(projectId, stageId, user);
  }

  @Post('items/:itemId/complete')
  completeItem(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.completeItem(projectId, itemId, user);
  }

  @Post('dependencies/:dependencyId/override')
  overrideDependency(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('dependencyId', ParseUUIDPipe) dependencyId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = parseBody(OverrideDependencySchema, body);
    return this.runtime.overrideDependency(
      projectId,
      dependencyId,
      parsed.reason,
      user,
    );
  }

  @Get(':workflowId/approvals')
  listApprovals(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.listApprovals(projectId, workflowId, user);
  }

  @Post(':workflowId/approvals')
  requestApproval(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = parseBody(CreateApprovalRequestSchema, body);
    return this.runtime.requestApproval(projectId, workflowId, parsed, user);
  }

  @Post(':workflowId/approvals/:approvalId/respond')
  respondApproval(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = parseBody(RespondApprovalSchema, body);
    return this.runtime.respondApproval(
      projectId,
      workflowId,
      approvalId,
      parsed,
      user,
    );
  }
}
