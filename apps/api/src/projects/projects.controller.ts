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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateProjectMembershipSchema,
  CreateProjectSchema,
  CreateProjectServiceSchema,
  ProjectListQuerySchema,
  UpdateProjectMembershipSchema,
  UpdateProjectSchema,
  UpdateProjectServiceSchema,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

const ScopedListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function invalidRequest(error: z.ZodError): never {
  throw new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: error.errors.map((item) => item.message).join(', '),
  });
}

@Controller()
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('admin/projects')
  @Roles('admin')
  async getAdminProjects(@Query() rawQuery: Record<string, string>) {
    const parsed = ProjectListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.getAdminProjects(parsed.data);
  }

  @Post('admin/projects')
  @Roles('admin')
  async createProject(
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.createProject(parsed.data, actorUserId);
  }

  @Get('admin/projects/:projectId')
  @Roles('admin')
  async getAdminProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectsService.getAdminProjectById(projectId);
  }

  @Patch('admin/projects/:projectId')
  @Roles('admin')
  async updateProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.updateProject(
      projectId,
      parsed.data,
      actorUserId,
    );
  }

  @Get('admin/projects/:projectId/members')
  @Roles('admin')
  async getMemberships(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectsService.getMemberships(projectId);
  }

  @Post('admin/projects/:projectId/members')
  @Roles('admin')
  async createMembership(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = CreateProjectMembershipSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.createMembership(
      projectId,
      parsed.data,
      actorUserId,
    );
  }

  @Patch('admin/projects/:projectId/members/:membershipId')
  @Roles('admin')
  async updateMembership(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateProjectMembershipSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.updateMembership(
      projectId,
      membershipId,
      parsed.data,
    );
  }

  @Delete('admin/projects/:projectId/members/:membershipId')
  @Roles('admin')
  async deleteMembership(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.projectsService.deleteMembership(projectId, membershipId);
  }

  @Get('admin/projects/:projectId/services')
  @Roles('admin')
  async getProjectServices(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.getProjectServices(projectId);
  }

  @Post('admin/projects/:projectId/services')
  @Roles('admin')
  async createProjectService(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = CreateProjectServiceSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.createProjectService(
      projectId,
      parsed.data,
      actorUserId,
    );
  }

  @Patch('admin/projects/:projectId/services/:projectServiceId')
  @Roles('admin')
  async updateProjectService(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('projectServiceId', ParseUUIDPipe) projectServiceId: string,
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = UpdateProjectServiceSchema.safeParse(body);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.updateProjectService(
      projectId,
      projectServiceId,
      parsed.data,
      actorUserId,
    );
  }

  @Delete('admin/projects/:projectId/services/:projectServiceId')
  @Roles('admin')
  async deleteProjectService(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('projectServiceId', ParseUUIDPipe) projectServiceId: string,
  ) {
    return this.projectsService.deleteProjectService(
      projectId,
      projectServiceId,
    );
  }

  @Get('projects')
  @Roles('team_leader', 'employee', 'accountant')
  async getInternalProjects(
    @CurrentUser('profileId') userId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const parsed = ScopedListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.getInternalProjects(
      userId,
      parsed.data.page,
      parsed.data.pageSize,
    );
  }

  @Get('projects/:projectId')
  @Roles('team_leader', 'employee', 'accountant')
  async getInternalProject(
    @CurrentUser('profileId') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.getInternalProjectById(userId, projectId);
  }

  @Get('client/me/projects')
  @Roles('client')
  async getClientProjects(
    @CurrentUser('profileId') userId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const parsed = ScopedListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) invalidRequest(parsed.error);
    return this.projectsService.getClientProjects(
      userId,
      parsed.data.page,
      parsed.data.pageSize,
    );
  }

  @Get('client/me/projects/:projectId')
  @Roles('client')
  async getClientProject(
    @CurrentUser('profileId') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectsService.getClientProjectById(userId, projectId);
  }
}
