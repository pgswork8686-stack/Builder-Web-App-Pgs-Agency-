import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
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

@Injectable()
export class WorkCalendarService {
  private readonly logger = new Logger(WorkCalendarService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  /**
   * Resolve working day status for a single date
   */
  async isWorkingDay(date: string): Promise<boolean> {
    const day = await this.resolveDay(date);
    return day.isWorkingDay;
  }

  /**
   * Resolve full details for a single date
   */
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

  /**
   * Get calendar for range (accessible to all internal authenticated users)
   */
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

    // Validate max range <= 366 days
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays > 366) {
      throw new BadRequestException({
        code: 'WORK_CALENDAR_INVALID_RANGE',
        message: 'Khoảng thời gian tra cứu không được vượt quá 366 ngày.',
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
      timezone: settings?.timezone || 'Asia/Ho_Chi_Minh',
      days,
    };
  }

  /**
   * Get Settings (Admin / Internal)
   */
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

    return data;
  }

  /**
   * Update Settings (Admin Only)
   */
  async updateSettings(dto: UpdateWorkCalendarSettingsDto, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message:
          'Chỉ quản trị viên mới có quyền cập nhật cấu hình lịch làm việc.',
      });
    }

    const current = await this.getSettings();

    const updatePayload: Record<string, any> = {
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

    return data;
  }

  /**
   * Get Events (Admin)
   */
  async getEvents(from?: string, to?: string) {
    let query = this.client
      .from('company_work_calendar_events')
      .select('*')
      .order('event_date', { ascending: true });

    if (from) {
      query = query.gte('event_date', from);
    }
    if (to) {
      query = query.lte('event_date', to);
    }

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

  /**
   * Create Manual Event (Admin Only)
   */
  async createEvent(dto: CreateWorkCalendarEventDto, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message: 'Chỉ quản trị viên mới có quyền tạo sự kiện lịch.',
      });
    }

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

  /**
   * Update Event (Admin Only)
   */
  async updateEvent(
    eventId: string,
    dto: UpdateWorkCalendarEventDto,
    user: RequestUser,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message: 'Chỉ quản trị viên mới có quyền chỉnh sửa sự kiện lịch.',
      });
    }

    const updatePayload: Record<string, any> = {
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

  /**
   * Delete Event (Admin Only)
   */
  async deleteEvent(eventId: string, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message: 'Chỉ quản trị viên mới có quyền xóa sự kiện lịch.',
      });
    }

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

  /**
   * Sync Holidays with Calendarific or Provider (Idempotent)
   */
  async syncHolidays(dto: SyncHolidaysDto, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new ForbiddenException({
        code: 'WORK_CALENDAR_FORBIDDEN',
        message: 'Chỉ quản trị viên mới có quyền đồng bộ ngày lễ.',
      });
    }

    const apiKey = this.configService.calendarificApiKey;
    if (!apiKey || apiKey.trim() === '') {
      throw new BadRequestException({
        code: 'HOLIDAY_PROVIDER_NOT_CONFIGURED',
        message:
          'Dịch vụ đồng bộ ngày lễ chưa được cấu hình khóa API (CALENDARIFIC_API_KEY).',
      });
    }

    const settings = await this.getSettings();
    const country = String(settings?.holiday_country_code || 'VN');
    const year = dto.year;

    const url = `https://calendarific.com/api/v2/holidays?api_key=${encodeURIComponent(apiKey)}&country=${encodeURIComponent(country)}&year=${year}&type=national`;

    let responseData: any;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}`,
        );
      }

      responseData = await response.json();
    } catch (fetchErr: any) {
      this.logger.error(`Calendarific API call failed: ${fetchErr.message}`);
      throw new BadRequestException({
        code: 'HOLIDAY_PROVIDER_FAILED',
        message: 'Không thể kết nối đến nhà cung cấp dữ liệu ngày lễ.',
      });
    }

    const holidays = responseData?.response?.holidays;
    if (!Array.isArray(holidays)) {
      this.logger.error(
        `Invalid holiday response structure: ${JSON.stringify(responseData)}`,
      );
      throw new BadRequestException({
        code: 'HOLIDAY_PROVIDER_FAILED',
        message: 'Dữ liệu trả về từ nhà cung cấp ngày lễ không hợp lệ.',
      });
    }

    let syncedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of holidays) {
      const dateIso = item.date?.iso?.substring(0, 10);
      const title = item.name || 'Ngày lễ Quốc gia';
      const externalId = `${country}_${year}_${item.urlid || item.name || dateIso}`;

      if (!dateIso) continue;

      // Upsert logic for API holidays
      // 1. Check if external_id exists for provider
      const { data: existing } = await this.client
        .from('company_work_calendar_events')
        .select('id, source_type')
        .eq('source_provider', 'calendarific')
        .eq('external_id', externalId)
        .maybeSingle();

      if (existing) {
        // Only update if it is an API-managed row (never overwrite manual)
        if (existing.source_type === 'api') {
          await this.client
            .from('company_work_calendar_events')
            .update({
              event_date: dateIso,
              title,
              is_working_day: false,
              raw_payload: item,
              synced_at: nowIso,
              updated_at: nowIso,
              updated_by: user.profileId,
            })
            .eq('id', existing.id);
          syncedCount++;
        }
      } else {
        // Insert new API holiday record
        const { error: insertError } = await this.client
          .from('company_work_calendar_events')
          .insert({
            event_date: dateIso,
            event_type: 'public_holiday',
            title,
            is_working_day: false,
            source_type: 'api',
            source_provider: 'calendarific',
            external_id: externalId,
            status: 'active',
            notes: item.description ?? null,
            raw_payload: item,
            synced_at: nowIso,
            created_by: user.profileId,
            updated_by: user.profileId,
          });

        if (!insertError) {
          syncedCount++;
        } else {
          this.logger.warn(
            `Could not insert holiday ${title} (${dateIso}): ${insertError.message}`,
          );
        }
      }
    }

    // Update settings last_holiday_sync_at
    await this.client
      .from('company_work_calendar_settings')
      .update({
        last_holiday_sync_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', settings.id);

    return {
      success: true,
      year,
      country,
      totalProviderHolidays: holidays.length,
      syncedCount,
      lastHolidaySyncAt: nowIso,
    };
  }
}
