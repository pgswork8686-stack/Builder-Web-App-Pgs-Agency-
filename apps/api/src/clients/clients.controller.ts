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
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateClientCompanySchema,
  UpdateClientCompanySchema,
  CreateClientMembershipSchema,
  UpdateClientMembershipSchema,
} from './dto/client.dto';
import { ClientsService } from './clients.service';

@Controller()
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // --- CLIENT OWN COMPANY SCOPE ---
  @Get('api/v1/client/me/companies')
  @Roles('client')
  async getMyCompanies(@CurrentUser('authUserId') userId: string) {
    return this.clientsService.getClientOwnCompanies(userId);
  }

  // --- ADMIN CLIENT COMPANIES ---
  @Get('api/v1/admin/clients')
  @Roles('admin')
  async getClientCompanies(
    @Query('q') query?: string,
    @Query('status') status?: 'active' | 'inactive',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    return this.clientsService.getClientCompanies({
      query,
      status,
      page: pageNum,
      pageSize: sizeNum,
    });
  }

  @Get('api/v1/admin/clients/:clientId')
  @Roles('admin')
  async getClientCompanyById(
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.clientsService.getClientCompanyById(clientId);
  }

  @Post('api/v1/admin/clients')
  @Roles('admin')
  async createClientCompany(
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = CreateClientCompanySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.clientsService.createClientCompany(result.data, adminUserId);
  }

  @Patch('api/v1/admin/clients/:clientId')
  @Roles('admin')
  async updateClientCompany(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = UpdateClientCompanySchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.clientsService.updateClientCompany(
      clientId,
      result.data,
      adminUserId,
    );
  }

  // --- ADMIN CLIENT MEMBERSHIPS ---
  @Get('api/v1/admin/clients/:clientId/members')
  @Roles('admin')
  async getMemberships(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.clientsService.getMemberships(clientId);
  }

  @Post('api/v1/admin/clients/:clientId/members')
  @Roles('admin')
  async createMembership(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() body: unknown,
    @CurrentUser('authUserId') adminUserId: string,
  ) {
    const result = CreateClientMembershipSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.clientsService.createMembership(
      clientId,
      result.data,
      adminUserId,
    );
  }

  @Patch('api/v1/admin/clients/:clientId/members/:membershipId')
  @Roles('admin')
  async updateMembership(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: unknown,
  ) {
    const result = UpdateClientMembershipSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.clientsService.updateMembership(
      clientId,
      membershipId,
      result.data,
    );
  }

  @Delete('api/v1/admin/clients/:clientId/members/:membershipId')
  @Roles('admin')
  async deleteMembership(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.clientsService.deleteMembership(clientId, membershipId);
  }
}
