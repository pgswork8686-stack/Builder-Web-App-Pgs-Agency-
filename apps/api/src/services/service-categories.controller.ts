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
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { ServicesService } from './services.service';
import {
  CreateServiceCategorySchema,
  ServiceCategoryQuerySchema,
  UpdateServiceCategorySchema,
} from './dto/service-category.dto';

@Controller('admin/service-categories')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class ServiceCategoriesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getCategories(@Query() rawQuery: unknown) {
    const result = ServiceCategoryQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.getCategories(result.data);
  }

  @Get(':id')
  async getCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.getCategoryById(id);
  }

  @Post()
  async createCategory(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateServiceCategorySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.createCategory(result.data, user.profileId);
  }

  @Patch(':id')
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpdateServiceCategorySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.updateCategory(id, result.data, user.profileId);
  }

  @Delete(':id')
  async deactivateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.servicesService.deactivateCategory(id, user.profileId);
  }
}
