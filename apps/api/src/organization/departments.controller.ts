import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
} from './dto/department.dto';
import { OrganizationService } from './organization.service';

@Controller('admin/departments')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class DepartmentsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async getDepartments() {
    return this.organizationService.getDepartments();
  }

  @Get(':id')
  async getDepartmentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getDepartmentById(id);
  }

  @Post()
  async createDepartment(
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = CreateDepartmentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.organizationService.createDepartment(result.data, adminUserId);
  }

  @Patch(':id')
  async updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = UpdateDepartmentSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.organizationService.updateDepartment(
      id,
      result.data,
      adminUserId,
    );
  }
}
