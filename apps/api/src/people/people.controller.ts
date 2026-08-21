import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { z } from 'zod';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateEmploymentSchema,
  UpdateEmploymentSchema,
  UpdatePersonFullSchema,
  AssignUserProjectsSchema,
  UpdateOwnProfileSchema,
} from './dto/employment.dto';
import { PeopleService } from './people.service';

// ---------------------------------------------------------------------------
// Zod schema for GET /admin/people query params
// ---------------------------------------------------------------------------
const PeopleDirectoryQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Từ khóa tìm kiếm tối đa 100 ký tự.')
    .optional(),
  role: z
    .enum(['admin', 'team_leader', 'employee', 'accountant', 'client'], {
      errorMap: () => ({
        message:
          'role không hợp lệ. Các giá trị cho phép: admin, team_leader, employee, accountant, client.',
      }),
    })
    .optional(),
  departmentId: z
    .string()
    .uuid('departmentId phải là định dạng UUID hợp lệ.')
    .optional(),
  teamId: z.string().uuid('teamId phải là định dạng UUID hợp lệ.').optional(),
  employmentStatus: z
    .enum(['probation', 'active', 'on_leave', 'terminated'], {
      errorMap: () => ({
        message:
          'employmentStatus không hợp lệ. Các giá trị cho phép: probation, active, on_leave, terminated.',
      }),
    })
    .optional(),
  page: z.coerce
    .number({ invalid_type_error: 'Tham số page không hợp lệ.' })
    .int('page phải là số nguyên.')
    .min(1, 'page phải từ 1.')
    .default(1),
  pageSize: z.coerce
    .number({ invalid_type_error: 'Tham số pageSize không hợp lệ.' })
    .int('pageSize phải là số nguyên.')
    .min(1, 'pageSize phải từ 1.')
    .max(100, 'pageSize tối đa 100.')
    .default(20),
});

// ---------------------------------------------------------------------------

@Controller()
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  // --- OWN ORGANIZATION SCOPE ---
  @Get('me/organization')
  async getMeOrganization(@CurrentUser() user: any) {
    return this.peopleService.getOwnOrganizationContext(
      user.authUserId,
      user.role as string,
    );
  }

  // --- OWN PROFILE UPDATE ---
  @Patch('me/profile')
  async updateMyProfile(
    @CurrentUser('authUserId') userId: string,
    @Body() body: unknown,
  ) {
    const result = UpdateOwnProfileSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.peopleService.updateOwnProfile(userId, result.data);
  }

  // --- TEAM LEADER SCOPE ---
  @Get('team/members')
  @Roles('team_leader')
  async getTeamMembers(@CurrentUser('authUserId') leaderUserId: string) {
    return this.peopleService.getTeamMembersForLeader(leaderUserId);
  }

  // --- ADMIN DIRECTORY ---
  @Get('admin/people')
  @Roles('admin')
  async getPeopleDirectory(@Query() rawQuery: Record<string, string>) {
    const parsed = PeopleDirectoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors.map((e) => e.message).join(', '),
      );
    }
    const { q, role, departmentId, teamId, employmentStatus, page, pageSize } =
      parsed.data;
    return this.peopleService.getPeopleDirectory({
      query: q,
      role,
      departmentId,
      teamId,
      employmentStatus,
      page,
      pageSize,
    });
  }

  @Get('admin/people/:userId')
  @Roles('admin')
  async getPersonByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.peopleService.getPersonByUserId(userId);
  }

  @Post('admin/people/:userId/employment')
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

  @Patch('admin/people/:userId/employment')
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

  @Patch('admin/people/:userId/full')
  @Roles('admin')
  async updatePersonFull(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = UpdatePersonFullSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.peopleService.updatePersonFull(
      userId,
      result.data,
      adminUserId,
    );
  }

  @Delete('admin/people/:userId')
  @Roles('admin')
  async deletePerson(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    return this.peopleService.deletePerson(userId, adminUserId);
  }

  @Get('admin/people/:userId/projects')
  @Roles('admin')
  async getUserProjects(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.peopleService.getUserProjects(userId);
  }

  @Post('admin/people/:userId/projects')
  @Roles('admin')
  async assignUserProjects(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = AssignUserProjectsSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.peopleService.assignUserProjects(
      userId,
      result.data,
      adminUserId,
    );
  }
}
