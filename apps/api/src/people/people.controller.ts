import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RequestUser } from '../auth/auth.types';
import {
  CreateEmploymentSchema,
  UpdateEmploymentSchema,
} from './dto/employment.dto';
import { PeopleService } from './people.service';

@Controller()
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  // --- OWN ORGANIZATION SCOPE ---
  @Get('api/v1/me/organization')
  async getMeOrganization(@CurrentUser() user: any) {
    return this.peopleService.getOwnOrganizationContext(
      user.authUserId,
      user.role as string,
    );
  }

  // --- TEAM LEADER SCOPE ---
  @Get('api/v1/team/members')
  @Roles('team_leader')
  async getTeamMembers(@CurrentUser('authUserId') leaderUserId: string) {
    return this.peopleService.getTeamMembersForLeader(leaderUserId);
  }

  // --- ADMIN DIRECTORY ---
  @Get('api/v1/admin/people')
  @Roles('admin')
  async getPeopleDirectory(
    @Query('q') query?: string,
    @Query('role') role?: string,
    @Query('departmentId') departmentId?: string,
    @Query('teamId') teamId?: string,
    @Query('employmentStatus') employmentStatus?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    return this.peopleService.getPeopleDirectory({
      query,
      role,
      departmentId,
      teamId,
      employmentStatus,
      page: pageNum,
      pageSize: sizeNum,
    });
  }

  @Get('api/v1/admin/people/:userId')
  @Roles('admin')
  async getPersonByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.peopleService.getPersonByUserId(userId);
  }

  @Post('api/v1/admin/people/:userId/employment')
  @Roles('admin')
  async createEmployment(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = CreateEmploymentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.peopleService.createEmploymentProfile(
      userId,
      result.data,
      adminUserId,
    );
  }

  @Patch('api/v1/admin/people/:userId/employment')
  @Roles('admin')
  async updateEmployment(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = UpdateEmploymentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.peopleService.updateEmploymentProfile(
      userId,
      result.data,
      adminUserId,
    );
  }
}
