import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AutomationExecutionsQuery,
  AutomationManualEventDto,
  AutomationRuleCreateDto,
  AutomationRuleQuery,
  AutomationRuleUpdateDto,
  AutomationTrigger,
} from './dto/automation.dto';

interface AutomationEvent {
  triggerType: AutomationTrigger;
  eventKey: string;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
  defaultRecipients?: string[];
  title?: string;
  message?: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private enforceAdmin(user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'AUTOMATION_ADMIN_REQUIRED',
        message: 'Chi quan tri vien moi duoc quan ly automation.',
      });
    }
  }

  private databaseFailure(
    code: string,
    message: string,
    error: unknown,
  ): never {
    const detail =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'unknown database error';
    this.logger.error(`${code}: ${detail}`);
    throw new InternalServerErrorException({ code, message });
  }

  private mapRule(row: Record<string, any>) {
    return {
      id: row.id,
      name: row.name,
      triggerType: row.trigger_type,
      conditions: row.conditions ?? {},
      actionType: row.action_type,
      actionConfig: row.action_config ?? {},
      isEnabled: row.is_enabled,
      createdBy: row.created_by ?? null,
      updatedBy: row.updated_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapExecution(row: Record<string, any>) {
    return {
      id: row.id,
      ruleId: row.rule_id,
      eventKey: row.event_key,
      triggerType: row.trigger_type,
      actionType: row.action_type,
      status: row.status,
      payload: row.payload ?? {},
      result: row.result ?? {},
      errorMessage: row.error_message ?? null,
      executedAt: row.executed_at,
      createdAt: row.created_at,
      rule: row.rule ?? null,
    };
  }

  async listRules(query: AutomationRuleQuery, user: RequestUser) {
    this.enforceAdmin(user);
    const offset = (query.page - 1) * query.pageSize;
    let dbQuery = this.client
      .from('automation_rules')
      .select('*', { count: 'exact' });

    if (query.triggerType)
      dbQuery = dbQuery.eq('trigger_type', query.triggerType);
    if (query.enabled !== undefined)
      dbQuery = dbQuery.eq('is_enabled', query.enabled);

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.databaseFailure(
        'AUTOMATION_RULES_LOOKUP_FAILED',
        'Khong the tai danh sach automation.',
        error,
      );
    }

    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapRule(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async createRule(dto: AutomationRuleCreateDto, user: RequestUser) {
    this.enforceAdmin(user);
    const { data, error } = await this.client
      .from('automation_rules')
      .insert({
        name: dto.name.trim(),
        trigger_type: dto.triggerType,
        conditions: dto.conditions ?? {},
        action_type: dto.actionType,
        action_config: dto.actionConfig ?? {},
        is_enabled: dto.isEnabled,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select()
      .single();

    if (error) {
      this.databaseFailure(
        'AUTOMATION_RULE_CREATE_FAILED',
        'Khong the tao automation rule.',
        error,
      );
    }
    return this.mapRule(data);
  }

  async updateRule(
    ruleId: string,
    dto: AutomationRuleUpdateDto,
    user: RequestUser,
  ) {
    this.enforceAdmin(user);
    const payload: Record<string, unknown> = { updated_by: user.profileId };
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.triggerType !== undefined) payload.trigger_type = dto.triggerType;
    if (dto.conditions !== undefined) payload.conditions = dto.conditions;
    if (dto.actionType !== undefined) payload.action_type = dto.actionType;
    if (dto.actionConfig !== undefined)
      payload.action_config = dto.actionConfig;
    if (dto.isEnabled !== undefined) payload.is_enabled = dto.isEnabled;

    const { data, error } = await this.client
      .from('automation_rules')
      .update(payload)
      .eq('id', ruleId)
      .select()
      .maybeSingle();

    if (error) {
      this.databaseFailure(
        'AUTOMATION_RULE_UPDATE_FAILED',
        'Khong the cap nhat automation rule.',
        error,
      );
    }
    if (!data) {
      throw new BadRequestException({
        code: 'AUTOMATION_RULE_NOT_FOUND',
        message: 'Khong tim thay automation rule.',
      });
    }
    return this.mapRule(data);
  }

  async listExecutions(query: AutomationExecutionsQuery, user: RequestUser) {
    this.enforceAdmin(user);
    const offset = (query.page - 1) * query.pageSize;
    let dbQuery = this.client
      .from('automation_executions')
      .select('*, rule:automation_rules(id,name)', { count: 'exact' });

    if (query.ruleId) dbQuery = dbQuery.eq('rule_id', query.ruleId);
    if (query.triggerType)
      dbQuery = dbQuery.eq('trigger_type', query.triggerType);
    if (query.status) dbQuery = dbQuery.eq('status', query.status);

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + query.pageSize - 1);

    if (error) {
      this.databaseFailure(
        'AUTOMATION_EXECUTIONS_LOOKUP_FAILED',
        'Khong the tai lich su automation.',
        error,
      );
    }

    const total = count ?? 0;
    return {
      items: (data ?? []).map((row) => this.mapExecution(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private conditionsMatch(
    conditions: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): boolean {
    for (const [key, expected] of Object.entries(conditions ?? {})) {
      if (key === 'daysAhead') continue;
      if (payload[key] !== expected) return false;
    }
    return true;
  }

  private async usersByRole(role: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id')
      .eq('role', role)
      .eq('account_status', 'active')
      .limit(100);
    if (error) {
      this.databaseFailure(
        'AUTOMATION_RECIPIENT_LOOKUP_FAILED',
        'Khong the xac dinh nguoi nhan automation.',
        error,
      );
    }
    return (data ?? []).map((row) => row.id);
  }

  private async usersByProject(projectId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('project_memberships')
      .select(
        'user_id, profile:profiles!project_memberships_user_id_fkey(account_status)',
      )
      .eq('project_id', projectId)
      .limit(100);
    if (error) {
      this.databaseFailure(
        'AUTOMATION_PROJECT_RECIPIENT_LOOKUP_FAILED',
        'Khong the xac dinh thanh vien du an.',
        error,
      );
    }
    return (data ?? [])
      .filter((row) => {
        const profile = Array.isArray(row.profile)
          ? row.profile[0]
          : row.profile;
        return profile?.account_status === 'active';
      })
      .map((row) => row.user_id);
  }

  private async usersByClientCompany(
    clientCompanyId: string,
  ): Promise<string[]> {
    const { data, error } = await this.client
      .from('client_memberships')
      .select(
        'user_id, profile:profiles!client_memberships_user_id_fkey(account_status)',
      )
      .eq('client_company_id', clientCompanyId)
      .limit(100);
    if (error) {
      this.databaseFailure(
        'AUTOMATION_CLIENT_RECIPIENT_LOOKUP_FAILED',
        'Khong the xac dinh nguoi nhan client.',
        error,
      );
    }
    return (data ?? [])
      .filter((row) => {
        const profile = Array.isArray(row.profile)
          ? row.profile[0]
          : row.profile;
        return profile?.account_status === 'active';
      })
      .map((row) => row.user_id);
  }

  private async resolveRecipients(
    actionConfig: Record<string, unknown>,
    event: AutomationEvent,
  ): Promise<string[]> {
    const recipients = new Set<string>(event.defaultRecipients ?? []);
    const explicit = actionConfig.recipientUserIds;
    if (Array.isArray(explicit)) {
      explicit
        .filter((value): value is string => typeof value === 'string')
        .slice(0, 100)
        .forEach((value) => recipients.add(value));
    }

    if (typeof actionConfig.recipientRole === 'string') {
      const byRole = await this.usersByRole(actionConfig.recipientRole);
      byRole.forEach((value) => recipients.add(value));
    }

    if (
      actionConfig.recipientFromPayload === 'assigneeUserId' &&
      typeof event.payload.assigneeUserId === 'string'
    ) {
      recipients.add(event.payload.assigneeUserId);
    }
    if (
      actionConfig.recipientFromPayload === 'requesterUserId' &&
      typeof event.payload.requesterUserId === 'string'
    ) {
      recipients.add(event.payload.requesterUserId);
    }

    if (
      actionConfig.projectMembersFromPayload === 'projectId' &&
      typeof event.payload.projectId === 'string'
    ) {
      const users = await this.usersByProject(event.payload.projectId);
      users.forEach((value) => recipients.add(value));
    }

    if (
      actionConfig.clientCompanyMembersFromPayload === 'clientCompanyId' &&
      typeof event.payload.clientCompanyId === 'string'
    ) {
      const users = await this.usersByClientCompany(
        event.payload.clientCompanyId,
      );
      users.forEach((value) => recipients.add(value));
    }

    if (event.actorUserId) recipients.delete(event.actorUserId);
    return [...recipients];
  }

  async runEvent(event: AutomationEvent) {
    const { data: rules, error } = await this.client
      .from('automation_rules')
      .select('*')
      .eq('trigger_type', event.triggerType)
      .eq('is_enabled', true)
      .limit(100);

    if (error) {
      this.logger.error(`Automation rule lookup failed: ${error.message}`);
      return { matchedRules: 0, executions: [] };
    }

    const executions: unknown[] = [];
    for (const rule of rules ?? []) {
      const conditions = (rule.conditions ?? {}) as Record<string, unknown>;
      if (!this.conditionsMatch(conditions, event.payload)) {
        continue;
      }

      const actionConfig = (rule.action_config ?? {}) as Record<
        string,
        unknown
      >;
      const recipients = await this.resolveRecipients(actionConfig, event);
      for (const recipientUserId of recipients) {
        try {
          const { data, error: rpcError } = await this.client.rpc(
            'phase7_create_automation_notification_once',
            {
              p_rule_id: rule.id,
              p_event_key: `${event.eventKey}:notification:${recipientUserId}`,
              p_trigger_type: event.triggerType,
              p_payload: event.payload,
              p_recipient_user_id: recipientUserId,
              p_type: event.triggerType,
              p_title:
                typeof actionConfig.title === 'string'
                  ? actionConfig.title
                  : (event.title ?? rule.name),
              p_message:
                typeof actionConfig.message === 'string'
                  ? actionConfig.message
                  : (event.message ?? rule.name),
              p_entity_type: event.entityType ?? null,
              p_entity_id: event.entityId ?? null,
              p_action_url:
                typeof actionConfig.actionUrl === 'string'
                  ? actionConfig.actionUrl
                  : (event.actionUrl ?? null),
              p_metadata: { ruleId: rule.id, ...event.payload },
            },
          );
          if (rpcError) throw rpcError;

          const notificationId =
            data && typeof data === 'object'
              ? (data as { notification_id?: unknown }).notification_id
              : '';
          if (typeof notificationId === 'string' && notificationId.length > 0) {
            await this.notificationsService.publishExisting(
              notificationId,
              recipientUserId,
            );
          }
          executions.push(data);
        } catch (automationError) {
          const message =
            automationError instanceof Error
              ? automationError.message
              : 'automation failure';
          this.logger.error(`Automation execution failed: ${message}`);
          await this.client.rpc('phase7_record_automation_failure_once', {
            p_rule_id: rule.id,
            p_event_key: `${event.eventKey}:notification:${recipientUserId}`,
            p_trigger_type: event.triggerType,
            p_payload: event.payload,
            p_error_message: message,
          });
        }
      }
    }

    return { matchedRules: rules?.length ?? 0, executions };
  }

  async runManualEvent(dto: AutomationManualEventDto, user: RequestUser) {
    this.enforceAdmin(user);
    return this.runEvent({
      triggerType: dto.triggerType,
      eventKey: `manual:${dto.triggerType}:${dto.eventKey}`,
      payload: dto.payload,
      actorUserId: user.profileId,
    });
  }

  private getVietnamDateOnly(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
  }

  async runScheduled(user: RequestUser) {
    this.enforceAdmin(user);
    const today = this.getVietnamDateOnly();
    const executions: unknown[] = [];

    const { data: invoices, error: invoiceError } = await this.client
      .from('invoices')
      .select('id,invoice_number,client_company_id,project_id,due_date,status')
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .lt('due_date', today)
      .eq('client_visible', true)
      .limit(100);

    if (invoiceError) {
      this.databaseFailure(
        'AUTOMATION_SCHEDULED_INVOICE_LOOKUP_FAILED',
        'Khong the quet hoa don qua han.',
        invoiceError,
      );
    }

    for (const invoice of invoices ?? []) {
      const result = await this.runEvent({
        triggerType: 'invoice.overdue',
        eventKey: `scheduled:invoice.overdue:${today}:${invoice.id}`,
        payload: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          clientCompanyId: invoice.client_company_id,
          projectId: invoice.project_id,
          dueDate: invoice.due_date,
          status: invoice.status,
        },
        actorUserId: user.profileId,
        title: 'Hoa don qua han',
        message: `Hoa don ${invoice.invoice_number} da qua han thanh toan.`,
        entityType: 'invoice',
        entityId: invoice.id,
        actionUrl: `/app/client/invoices`,
      });
      executions.push(result);
    }

    return {
      businessDate: today,
      invoiceOverdueScanned: invoices?.length ?? 0,
      executions,
    };
  }
}
