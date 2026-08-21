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
import {
  CreateServiceDeliveryItemSchema,
  UpdateServiceDeliveryItemSchema,
} from './dto/service-delivery-item.dto';
import {
  CreateServiceSchema,
  ServiceListQuerySchema,
  UpdateServiceSchema,
} from './dto/service.dto';
import { UpdateServiceResponsibilitySchema } from './dto/service-responsibility.dto';
import { ServicesService } from './services.service';

@Controller('admin/services')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('admin')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getServices(@Query() rawQuery: unknown) {
    const result = ServiceListQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.getServices(result.data);
  }

  @Get(':id')
  async getServiceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.getServiceById(id);
  }

  @Post()
  async createService(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = CreateServiceSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.createService(result.data, user.profileId);
  }

  @Patch(':id')
  async updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpdateServiceSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.updateService(id, result.data, user.profileId);
  }

  @Delete(':id')
  async deactivateService(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.servicesService.deactivateService(id, user.profileId);
  }

  // ============================================================
  // SERVICE RESPONSIBILITY
  // ============================================================

  @Get(':serviceId/responsibilities')
  async getServiceResponsibilities(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.servicesService.getServiceResponsibilities(serviceId);
  }

  @Patch(':serviceId/responsibilities')
  async updateServiceResponsibilities(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpdateServiceResponsibilitySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.updateServiceResponsibilities(
      serviceId,
      result.data,
      user.profileId,
    );
  }

  // ============================================================
  // SERVICE DELIVERY ITEMS (Template Items)
  // ============================================================

  @Get(':serviceId/delivery-items')
  async getDeliveryItems(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.servicesService.getDeliveryItems(serviceId);
  }

  @Post(':serviceId/delivery-items')
  async createDeliveryItem(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateServiceDeliveryItemSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.createDeliveryItem(
      serviceId,
      result.data,
      user.profileId,
    );
  }

  @Patch(':serviceId/delivery-items/:itemId')
  async updateDeliveryItem(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpdateServiceDeliveryItemSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.servicesService.updateDeliveryItem(
      serviceId,
      itemId,
      result.data,
      user.profileId,
    );
  }

  @Delete(':serviceId/delivery-items/:itemId')
  async deleteDeliveryItem(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.servicesService.deleteDeliveryItem(
      serviceId,
      itemId,
      user.profileId,
    );
  }
}
