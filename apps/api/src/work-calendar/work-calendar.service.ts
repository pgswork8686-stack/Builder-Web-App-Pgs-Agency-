import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';
import type {
  CreateWorkCalendarEventDto,
  SyncHolidaysDto,
  UpdateWorkCalendarEventDto,
  UpdateWorkCalendarSettingsDto,
} from './dto/work-calendar.dto';

export interface WorkCalendarDay {
  date: string;
  isWorkingDay: boolean;
  reason: string;
  title: string;
  sourceType: string;
  eventType: string | null;
}

export interface WorkCalendarRangeResponse {
  from: string;
  to: string;
  timezone: string;
  days: WorkCalendarDay[];
}

type HolidaySyncMode = 'manual' | 'auto';

export interface HolidaySyncResult {
  success: true;
  year: number;
  country: string;
  totalProviderHolidays: number;
  syncedCount: number;
  lastHolidaySyncAt: string;
}

@Injectable()
export class WorkCalendarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkCalendarService.name);
  private readonly autoSyncCheckIntervalMs = 6 * 60 * 60 * 1000;
  private readonly autoSyncFreshnessMs = 24 * 60 * 60 * 1000;
  private autoSyncTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  onModuleInit() {
    if (this.configService.appEnv !== 'production') return;

    void this.runAutoHolidaySync().catch((error: unknown) => {
      this.logger.error(
        `Initial automatic holiday sync check failed: ${this.errorMessage(error)}`,
      );
    });

    this.autoSyncTimer = setInterval(() => {
      void this.runAutoHolidaySync().catch((error: unknown) => {
        this.logger.error(
          `Automatic holiday sync check failed: ${this.errorMessage(error)}`,
        );
      });
    }, this.autoSyncCheckIntervalMs);
    this.autoSyncTimer.unref();
  }

  onModuleDestroy() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  async isWorkingDay(date: string): Promise<boolean> {
    const day = await this.resolveDay(date);
    return day.isWorkingDay;
  }

  async resolveDay(date: string): Promise<WorkCalendarDay> {
    const { data, error } = await this.client.rpc('resolve_company_workday', {
      p_date: date,
    });

    if (error || !data || data.length === 0) {
      this.logger.error(
        `resolve_company_workday failed for ${date}: ${error?.message}`,
      );
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_LOOKUP_FAILED',
        message: 'Không thể tra cứu lịch làm việc của công ty.',
      });
    }

    const row = data[0];
    return {
      date: row.work_date,
      isWorkingDay: row.is_working_day,
      reason: row.reason,
      title:
        row.event_title || (row.is_working_day ? 'Ngày làm việc' : 'Ngày nghỉ'),
      sourceType: row.source_type,
      eventType: row.event_type ?? null,
    };
  }

  async getCalendarRange(
    from: string,
    to: string,
    user: RequestUser,
  ): Promise<WorkCalendarRangeResponse> {
    if (user.role === 'client') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_ACCESS_DENIED',
        message: 'Khách hàng không có quyền truy cập lịch nội bộ công ty.',
      });
    }

    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);
    const diffDays = Math.floor(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0 || diffDays > 366) {
      throw new BadRequestException({
        code: 'WORK_CALENDAR_INVALID_RANGE',
        message:
          'Khoảng thời gian tra cứu không hợp lệ hoặc vượt quá 366 ngày.',
      });
    }

    const settings = await this.getSettings();
    const { data, error } = await this.client.rpc('get_company_work_calendar', {
      p_from: from,
      p_to: to,
    });

    if (error) {
      this.logger.error(
        `get_company_work_calendar RPC failed: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_LOOKUP_FAILED',
        message: 'Không thể tải dữ liệu lịch làm việc.',
      });
    }

    const days: WorkCalendarDay[] = (data || []).map((row: any) => ({
      date: row.work_date,
      isWorkingDay: row.is_working_day,
      reason: row.reason,
      title:
        row.event_title || (row.is_working_day ? 'Ngày làm việc' : 'Ngày nghỉ'),
      sourceType: row.source_type,
      eventType: row.event_type ?? null,
    }));

    return {
      from,
      to,
      timezone: settings.timezone || 'Asia/Ho_Chi_Minh',
      days,
    };
  }

  async getSettings() {
    const { data, error } = await this.client
      .from('company_work_calendar_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to get work calendar settings: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_SETTINGS_LOOKUP_FAILED',
        message: 'Không thể đọc cấu hình lịch làm việc.',
      });
    }

    if (!data) {
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_SETTINGS_NOT_FOUND',
        message: 'Chưa có cấu hình lịch làm việc của công ty.',
      });
    }

    return data;
  }

  async updateSettings(dto: UpdateWorkCalendarSettingsDto, user: RequestUser) {
    this.assertAdmin(user);

    const current = await this.getSettings();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.timezone !== undefined) updatePayload.timezone = dto.timezone;
    if (dto.weekdayWorkingDays !== undefined)
      updatePayload.weekday_working_days = dto.weekdayWorkingDays;
    if (dto.alternateSaturdayEnabled !== undefined)
      updatePayload.alternate_saturday_enabled = dto.alternateSaturdayEnabled;
    if (dto.alternateSaturdayAnchorDate !== undefined)
      updatePayload.alternate_saturday_anchor_date =
        dto.alternateSaturdayAnchorDate;
    if (dto.alternateSaturdayAnchorIsWorking !== undefined)
      updatePayload.alternate_saturday_anchor_is_working =
        dto.alternateSaturdayAnchorIsWorking;
    if (dto.applyGovernmentMakeupDays !== undefined)
      updatePayload.apply_government_makeup_days =
        dto.applyGovernmentMakeupDays;
    if (dto.holidayCountryCode !== undefined)
      updatePayload.holiday_country_code = dto.holidayCountryCode;
    if (dto.holidayProvider !== undefined)
      updatePayload.holiday_provider = dto.holidayProvider;
    if (dto.autoHolidaySyncEnabled !== undefined)
      updatePayload.auto_holiday_sync_enabled = dto.autoHolidaySyncEnabled;

    const { data, error } = await this.client
      .from('company_work_calendar_settings')
      .update(updatePayload)
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to update calendar settings: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_UPDATE_FAILED',
        message: 'Không thể cập nhật cấu hình lịch làm việc.',
      });
    }

    if (
      this.configService.appEnv === 'production' &&
      dto.autoHolidaySyncEnabled === true &&
      data?.auto_holiday_sync_enabled === true
    ) {
      void this.runAutoHolidaySync().catch((syncError: unknown) => {
        this.logger.error(
          `Automatic holiday sync after enabling failed: ${this.errorMessage(syncError)}`,
        );
      });
    }

    return data;
  }

  async getEvents(from?: string, to?: string) {
    let query = this.client
      .from('company_work_calendar_events')
      .select('*')
      .order('event_date', { ascending: true });

    if (from) query = query.gte('event_date', from);
    if (to) query = query.lte('event_date', to);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to fetch events: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_LOOKUP_FAILED',
        message: 'Không thể tải danh sách sự kiện lịch.',
      });
    }

    return data || [];
  }

  async createEvent(dto: CreateWorkCalendarEventDto, user: RequestUser) {
    this.assertAdmin(user);

    const { data, error } = await this.client
      .from('company_work_calendar_events')
      .insert({
        event_date: dto.eventDate,
        event_type: dto.eventType,
        title: dto.title,
        is_working_day: dto.isWorkingDay,
        source_type: 'manual',
        status: 'active',
        notes: dto.notes ?? null,
        created_by: user.profileId,
        updated_by: user.profileId,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to create calendar event: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_CREATE_FAILED',
        message: 'Không thể tạo sự kiện ngoại lệ lịch làm việc.',
      });
    }

    return data;
  }

  async updateEvent(
    eventId: string,
    dto: UpdateWorkCalendarEventDto,
    user: RequestUser,
  ) {
    this.assertAdmin(user);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.profileId,
    };

    if (dto.eventDate !== undefined) updatePayload.event_date = dto.eventDate;
    if (dto.eventType !== undefined) updatePayload.event_type = dto.eventType;
    if (dto.title !== undefined) updatePayload.title = dto.title;
    if (dto.isWorkingDay !== undefined)
      updatePayload.is_working_day = dto.isWorkingDay;
    if (dto.notes !== undefined) updatePayload.notes = dto.notes;
    if (dto.status !== undefined) updatePayload.status = dto.status;

    const { data, error } = await this.client
      .from('company_work_calendar_events')
      .update(updatePayload)
      .eq('id', eventId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to update calendar event: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_UPDATE_FAILED',
        message: 'Không thể cập nhật sự kiện lịch làm việc.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'WORK_CALENDAR_EVENT_NOT_FOUND',
        message: 'Không tìm thấy sự kiện lịch cần cập nhật.',
      });
    }

    return data;
  }

  async deleteEvent(eventId: string, user: RequestUser) {
    this.assertAdmin(user);

    const { data, error } = await this.client
      .from('company_work_calendar_events')
      .delete()
      .eq('id', eventId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to delete calendar event: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'WORK_CALENDAR_DELETE_FAILED',
        message: 'Không thể xóa sự kiện lịch làm việc.',
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'WORK_CALENDAR_EVENT_NOT_FOUND',
        message: 'Không tìm thấy sự kiện lịch cần xóa.',
      });
    }

    return { success: true, deletedEvent: data };
  }

  async syncHolidays(
    dto: SyncHolidaysDto,
    user: RequestUser,
  ): Promise<HolidaySyncResult> {
    this.assertAdmin(user);
    const settings = await this.getSettings();
    return this.syncHolidaysForYear(
      dto.year,
      settings,
      user.profileId,
      'manual',
    );
  }

  async runAutoHolidaySync(now = new Date()) {
    const settings = await this.getSettings();

    if (!settings.auto_holiday_sync_enabled) {
      return { status: 'skipped' as const, reason: 'disabled' as const };
    }

    if (!this.configService.calendarificApiKey?.trim()) {
      this.logger.warn(
        'Automatic holiday sync is enabled but CALENDARIFIC_API_KEY is not configured.',
      );
      return {
        status: 'skipped' as const,
        reason: 'provider_not_configured' as const,
      };
    }

    const provider = String(settings.holiday_provider || 'calendarific');
    if (provider !== 'calendarific') {
      this.logger.warn(
        `Automatic holiday sync skipped: unsupported provider ${provider}.`,
      );
      return {
        status: 'skipped' as const,
        reason: 'unsupported_provider' as const,
      };
    }

    const timezone = String(settings.timezone || 'Asia/Ho_Chi_Minh');
    const year = this.yearInTimezone(now, timezone);
    const country = String(settings.holiday_country_code || 'VN');

    if (
      await this.wasHolidayYearSyncedRecently(
        provider,
        country,
        year,
        now,
        this.autoSyncFreshnessMs,
      )
    ) {
      return { status: 'skipped' as const, reason: 'fresh' as const, year };
    }

    const result = await this.syncHolidaysForYear(year, settings, null, 'auto');
    return { status: 'synced' as const, result };
  }

  private async syncHolidaysForYear(
    year: number,
    settings: any,
    actorProfileId: string | null,
    mode: HolidaySyncMode,
  ): Promise<HolidaySyncResult> {
    const apiKey = this.configService.calendarificApiKey;
    if (!apiKey?.trim()) {
      throw new BadRequestException({
        code: 'HOLIDAY_PROVIDER_NOT_CONFIGURED',
        message:
          'Dịch vụ đồng bộ ngày lễ chưa được cấu hình khóa API (CALENDARIFIC_API_KEY).',
      });
    }

    const provider = String(settings?.holiday_provider || 'calendarific');
    if (provider !== 'calendarific') {
      throw new BadRequestException({
        code: 'HOLIDAY_PROVIDER_UNSUPPORTED',
        message: 'Nhà cung cấp dữ liệu ngày lễ hiện chưa được hỗ trợ.',
      });
    }

    const country = String(settings?.holiday_country_code || 'VN');
    const runId = await this.createHolidaySyncRun(
      provider,
      country,
      year,
      mode,
    );

    try {
      const url = `https://calendarific.com/api/v2/holidays?api_key=${encodeURIComponent(apiKey)}&country=${encodeURIComponent(country)}&year=${year}&type=national`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new BadRequestException({
          code: 'HOLIDAY_PROVIDER_FAILED',
          message: 'Nhà cung cấp dữ liệu ngày lễ trả về lỗi.',
        });
      }

      const responseData: any = await response.json();
      const holidays = responseData?.response?.holidays;

      if (!Array.isArray(holidays)) {
        throw new BadRequestException({
          code: 'HOLIDAY_PROVIDER_FAILED',
          message: 'Dữ liệu trả về từ nhà cung cấp ngày lễ không hợp lệ.',
        });
      }

      let syncedCount = 0;
      const nowIso = new Date().toISOString();

      for (const item of holidays) {
        const dateIso = item.date?.iso?.substring(0, 10);
        if (!dateIso) continue;

        const title = item.name || 'Ngày lễ Quốc gia';
        const externalId = `${country}_${year}_${item.urlid || item.name || dateIso}`;

        const { data: existing, error: lookupError } = await this.client
          .from('company_work_calendar_events')
          .select('id, source_type')
          .eq('source_provider', provider)
          .eq('external_id', externalId)
          .maybeSingle();

        if (lookupError) throw new Error('holiday event lookup failed');

        if (existing) {
          if (existing.source_type !== 'api') continue;

          const { error: updateError } = await this.client
            .from('company_work_calendar_events')
            .update({
              event_date: dateIso,
              title,
              is_working_day: false,
              source_ref: item.urlid ?? null,
              raw_payload: item,
              synced_at: nowIso,
              updated_at: nowIso,
              updated_by: actorProfileId,
            })
            .eq('id', existing.id);

          if (updateError) throw new Error('holiday event update failed');
          syncedCount += 1;
          continue;
        }

        const { error: insertError } = await this.client
          .from('company_work_calendar_events')
          .insert({
            event_date: dateIso,
            event_type: 'public_holiday',
            title,
            is_working_day: false,
            source_type: 'api',
            source_provider: provider,
            source_ref: item.urlid ?? null,
            external_id: externalId,
            status: 'active',
            notes: item.description ?? null,
            raw_payload: item,
            synced_at: nowIso,
            created_by: actorProfileId,
            updated_by: actorProfileId,
          });

        if (insertError) throw new Error('holiday event insert failed');
        syncedCount += 1;
      }

      const { error: settingsUpdateError } = await this.client
        .from('company_work_calendar_settings')
        .update({
          last_holiday_sync_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', settings.id);

      if (settingsUpdateError) {
        throw new Error('holiday sync settings update failed');
      }

      await this.finishHolidaySyncRun(runId, 'succeeded', syncedCount, null);

      return {
        success: true,
        year,
        country,
        totalProviderHolidays: holidays.length,
        syncedCount,
        lastHolidaySyncAt: nowIso,
      };
    } catch (error: unknown) {
      await this.finishHolidaySyncRun(
        runId,
        'failed',
        0,
        this.safeSyncErrorCode(error),
      );

      if (error instanceof BadRequestException) throw error;

      this.logger.error(
        `Holiday sync failed for ${country}/${year}: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException({
        code: 'HOLIDAY_SYNC_FAILED',
        message: 'Không thể đồng bộ dữ liệu ngày lễ vào hệ thống.',
      });
    }
  }

  private async wasHolidayYearSyncedRecently(
    provider: string,
    country: string,
    year: number,
    now: Date,
    freshnessMs: number,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('company_holiday_sync_runs')
      .select('started_at')
      .eq('provider', provider)
      .eq('country_code', country)
      .eq('holiday_year', year)
      .eq('status', 'succeeded')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Could not read holiday sync history: ${error.message}`);
      return false;
    }
    if (!data?.started_at) return false;

    const startedAt = new Date(String(data.started_at)).getTime();
    return (
      Number.isFinite(startedAt) && now.getTime() - startedAt < freshnessMs
    );
  }

  private async createHolidaySyncRun(
    provider: string,
    country: string,
    year: number,
    mode: HolidaySyncMode,
  ): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('company_holiday_sync_runs')
        .insert({
          provider,
          country_code: country,
          holiday_year: year,
          status: 'running',
          imported_count: 0,
          metadata: { mode },
        })
        .select('id')
        .single();

      if (error) {
        this.logger.warn(`Could not create holiday sync run: ${error.message}`);
        return null;
      }
      return data?.id ?? null;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not create holiday sync run: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private async finishHolidaySyncRun(
    runId: string | null,
    status: 'succeeded' | 'failed',
    importedCount: number,
    errorMessage: string | null,
  ) {
    if (!runId) return;

    try {
      const { error } = await this.client
        .from('company_holiday_sync_runs')
        .update({
          status,
          imported_count: importedCount,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) {
        this.logger.warn(
          `Could not finalize holiday sync run: ${error.message}`,
        );
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Could not finalize holiday sync run: ${this.errorMessage(error)}`,
      );
    }
  }

  private yearInTimezone(now: Date, timezone: string): number {
    const yearPart = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
    })
      .formatToParts(now)
      .find((part) => part.type === 'year')?.value;
    return Number(yearPart || now.getUTCFullYear());
  }

  private assertAdmin(user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message: 'Chỉ quản trị viên mới có quyền thay đổi lịch làm việc.',
      });
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private safeSyncErrorCode(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'code' in response &&
        typeof (response as { code?: unknown }).code === 'string'
      ) {
        return (response as { code: string }).code;
      }
    }
    return 'HOLIDAY_SYNC_FAILED';
  }
}
