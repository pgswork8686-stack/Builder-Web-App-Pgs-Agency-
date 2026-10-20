import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ActiveAccountGuard } from '../auth/active-account.guard';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WorkflowRuntimeService } from './workflow-runtime.service';

export const ClientApprovalListQuerySchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/** Aggregated acceptance requests for the signed-in client, across projects. */
@Controller('client/me/approvals')
@UseGuards(AuthGuard, ActiveAccountGuard, RolesGuard)
@Roles('client')
export class ClientApprovalsController {
  constructor(private readonly runtime: WorkflowRuntimeService) {}

  @Get()
  list(
    @CurrentUser('profileId') userId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const parsed = ClientApprovalListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid approval list request.',
        issues: parsed.error.issues,
      });
    }
    return this.runtime.listClientApprovals(userId, parsed.data);
  }
}
