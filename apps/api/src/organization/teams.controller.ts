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
import { CreateTeamSchema, UpdateTeamSchema } from './dto/team.dto';
import { OrganizationService } from './organization.service';

@Controller('admin/teams')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class TeamsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async getTeams(
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
    @Query('q') query?: string,
  ) {
    const activeFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.organizationService.getTeams(departmentId, activeFilter, query);
  }

  @Get(':id')
  async getTeamById(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getTeamById(id);
  }

  @Post()
  async createTeam(
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = CreateTeamSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.organizationService.createTeam(result.data, adminUserId);
  }

  @Patch(':id')
  async updateTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = UpdateTeamSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.organizationService.updateTeam(id, result.data, adminUserId);
  }
}
