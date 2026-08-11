import {
  BadRequestException,
  Body,
  Controller,
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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateServiceSchema,
  ServiceListQuerySchema,
  UpdateServiceSchema,
} from './dto/service.dto';
import { ServicesService } from './services.service';

@Controller('admin/services')
@Roles('admin')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getServices(@Query() rawQuery: Record<string, string>) {
    const parsed = ServiceListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.servicesService.getServices(parsed.data);
  }

  @Post()
  async createService(
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = CreateServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.servicesService.createService(parsed.data, actorUserId);
  }

  @Get(':serviceId')
  async getService(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.servicesService.getServiceById(serviceId);
  }

  @Patch(':serviceId')
  async updateService(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: unknown,
    @CurrentUser('profileId') actorUserId: string,
  ) {
    const parsed = UpdateServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: parsed.error.errors.map((item) => item.message).join(', '),
      });
    }
    return this.servicesService.updateService(
      serviceId,
      parsed.data,
      actorUserId,
    );
  }
}
