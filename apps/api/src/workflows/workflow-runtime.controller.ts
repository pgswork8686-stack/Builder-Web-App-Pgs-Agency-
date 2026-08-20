import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { WorkflowRuntimeService } from './workflow-runtime.service';

@Controller('projects/:projectId/workflows')
@UseGuards(AuthGuard)
export class WorkflowRuntimeController {
  constructor(private readonly runtime: WorkflowRuntimeService) {}

  @Get()
  getProjectWorkflows(@Param('projectId') projectId: string) {
    return this.runtime.getProjectWorkflows(projectId);
  }

  @Post('project-services/:projectServiceId/instantiate')
  instantiateWorkflow(
    @Param('projectId') projectId: string,
    @Param('projectServiceId') projectServiceId: string,
  ) {
    return this.runtime.instantiateProjectServiceWorkflow(
      projectId,
      projectServiceId,
    );
  }

  @Post(':workflowId/start')
  startWorkflow(@Param('workflowId') workflowId: string) {
    return this.runtime.startWorkflow(workflowId);
  }

  @Post('stages/:stageId/start')
  startStage(@Param('stageId') stageId: string) {
    return this.runtime.startStage(stageId);
  }

  @Post('stages/:stageId/complete')
  completeStage(@Param('stageId') stageId: string) {
    return this.runtime.completeStage(stageId);
  }

  @Post('dependencies/:dependencyId/override')
  overrideDependency(
    @Param('dependencyId') dependencyId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runtime.overrideDependency(dependencyId, reason, user);
  }
}
