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
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { SupportService } from './support.service';
import {
  CreateSupportTicketSchema,
  CreateTicketMessageSchema,
  SupportTicketQuerySchema,
  UpdateTicketStatusSchema,
} from './dto/support.dto';

@Controller('support')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  @Roles('admin', 'team_leader', 'employee', 'client')
  async listTickets(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = SupportTicketQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.supportService.listTickets(result.data, user);
  }

  @Get('tickets/:id')
  @Roles('admin', 'team_leader', 'employee', 'client')
  async getTicketById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.supportService.getTicketById(id, user);
  }

  @Post('tickets')
  @Roles('admin', 'client')
  async createTicket(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const result = CreateSupportTicketSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.supportService.createTicket(result.data, user);
  }

  @Post('tickets/:id/messages')
  @Roles('admin', 'team_leader', 'employee', 'client')
  async createMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = CreateTicketMessageSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.supportService.createMessage(id, result.data, user);
  }

  @Patch('tickets/:id/status')
  @Roles('admin', 'team_leader')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = UpdateTicketStatusSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.supportService.updateStatus(id, result.data, user);
  }
}
