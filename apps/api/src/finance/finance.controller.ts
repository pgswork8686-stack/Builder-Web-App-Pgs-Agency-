import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { FinanceService } from './finance.service';
import {
  ContractCreateSchema,
  ContractUpdateSchema,
  ContractTransitionSchema,
  InvoiceCreateSchema,
  InvoiceUpdateSchema,
  InvoiceTransitionSchema,
  PaymentRecordSchema,
  FinanceQuerySchema,
} from './dto/finance.dto';

@Controller('finance')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: RequestUser) {
    return this.financeService.getSummary(user);
  }

  @Get('contracts')
  async getContracts(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = FinanceQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.getContracts(result.data, user);
  }

  @Post('contracts')
  async createContract(
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = ContractCreateSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.createContract(result.data, user);
  }

  @Get('contracts/:id')
  async getContractById(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.getContractById(id, user);
  }

  @Patch('contracts/:id')
  async updateContract(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = ContractUpdateSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.updateContract(id, result.data, user);
  }

  @Post('contracts/:id/transition')
  async transitionContract(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = ContractTransitionSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.transitionContract(id, result.data.status, user);
  }

  @Get('invoices')
  async getInvoices(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = FinanceQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.getInvoices(result.data, user);
  }

  @Post('invoices')
  async createInvoice(
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = InvoiceCreateSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.createInvoice(result.data, user);
  }

  @Get('invoices/:id')
  async getInvoiceById(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.getInvoiceById(id, user);
  }

  @Patch('invoices/:id')
  async updateInvoice(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = InvoiceUpdateSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.updateInvoice(id, result.data, user);
  }

  @Post('invoices/:id/transition')
  async transitionInvoice(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = InvoiceTransitionSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.transitionInvoice(id, result.data.status, user);
  }

  @Post('invoices/:id/payments')
  async recordPayment(
    @Param('id') invoiceId: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = PaymentRecordSchema.safeParse(rawBody);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.recordPayment(invoiceId, result.data, user);
  }

  @Get('invoices/:id/payments')
  async getPayments(
    @Param('id') invoiceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.getPayments(invoiceId, user);
  }

  @Get('audit')
  async getAuditLogs(
    @Query() rawQuery: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    const result = FinanceQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException(
        result.error.errors.map((e) => e.message).join(', '),
      );
    }
    return this.financeService.getAuditLogs(result.data, user);
  }
}
