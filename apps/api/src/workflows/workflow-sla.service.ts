import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';

export interface SlaCalculationResult {
  configured: boolean;
  dueAt: string | null;
  reason?: string;
}

interface WorkTimeSettings {
  workday_start_time?: string | null;
  workday_end_time?: string | null;
  timezone?: string | null;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

@Injectable()
export class WorkflowSlaService {
  private readonly logger = new Logger(WorkflowSlaService.name);

  constructor(
    private readonly workCalendarService: WorkCalendarService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private get client() {
    return this.supabaseService.getSystemClient();
  }

  private zonedParts(date: Date, timeZone: string): ZonedParts {
    const values = new Map(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );
    return {
      year: Number(values.get('year')),
      month: Number(values.get('month')),
      day: Number(values.get('day')),
      hour: Number(values.get('hour')),
      minute: Number(values.get('minute')),
      second: Number(values.get('second')),
    };
  }

  private dateString(
    parts: Pick<ZonedParts, 'year' | 'month' | 'day'>,
  ): string {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private addLocalDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + days));
    return shifted.toISOString().slice(0, 10);
  }

  private localDateTimeToUtc(
    localDate: string,
    minuteOfDay: number,
    timeZone: string,
  ): Date {
    const [year, month, day] = localDate.split('-').map(Number);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let candidate = desiredWallClock;

    // Intl exposes wall-clock parts but not the numeric offset. Iterating the
    // wall-clock delta handles both fixed offsets and DST transitions.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = this.zonedParts(new Date(candidate), timeZone);
      const actualWallClock = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
      const delta = desiredWallClock - actualWallClock;
      candidate += delta;
      if (delta === 0) break;
    }
    return new Date(candidate);
  }

  private parseMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  async calculateDueAt(
    startDate: Date,
    slaHours: number,
    suppliedSettings?: WorkTimeSettings,
  ): Promise<SlaCalculationResult> {
    if (!slaHours || slaHours <= 0) {
      return { configured: true, dueAt: null };
    }
    return this.addWorkingDuration(startDate, slaHours, suppliedSettings);
  }

  async addWorkingDuration(
    startDate: Date,
    durationHours: number,
    suppliedSettings?: WorkTimeSettings,
  ): Promise<SlaCalculationResult> {
    if (!Number.isFinite(durationHours) || durationHours < 0) {
      return {
        configured: false,
        dueAt: null,
        reason: 'INVALID_WORKING_DURATION',
      };
    }
    if (durationHours === 0) {
      return { configured: true, dueAt: startDate.toISOString() };
    }

    let settings = suppliedSettings;
    if (!settings) {
      const { data, error } = await this.client
        .from('attendance_settings')
        .select('workday_start_time,workday_end_time,timezone')
        .limit(1)
        .maybeSingle();
      if (error) {
        this.logger.error(
          `WORKFLOW_SLA_SETTINGS_LOOKUP_FAILED: ${error.message}`,
        );
        throw new InternalServerErrorException({
          code: 'WORKFLOW_SLA_SETTINGS_LOOKUP_FAILED',
          message: 'Unable to load workflow SLA settings.',
        });
      }
      settings = data ?? undefined;
    }

    if (!settings?.workday_start_time || !settings.workday_end_time) {
      return {
        configured: false,
        dueAt: null,
        reason: 'WORK_HOURS_NOT_CONFIGURED',
      };
    }
    if (!settings.timezone) {
      return {
        configured: false,
        dueAt: null,
        reason: 'WORK_TIMEZONE_NOT_CONFIGURED',
      };
    }

    const workdayStart = this.parseMinutes(settings.workday_start_time);
    const workdayEnd = this.parseMinutes(settings.workday_end_time);
    if (workdayEnd <= workdayStart) {
      return { configured: false, dueAt: null, reason: 'INVALID_WORK_HOURS' };
    }

    const startParts = this.zonedParts(startDate, settings.timezone);
    let localDate = this.dateString(startParts);
    let localMinute = startParts.hour * 60 + startParts.minute;
    let remainingMinutes = Math.round(durationHours * 60);

    for (let inspectedDays = 0; inspectedDays < 366; inspectedDays += 1) {
      const day = await this.workCalendarService.resolveDay(localDate);
      if (!day.isWorkingDay) {
        localDate = this.addLocalDays(localDate, 1);
        localMinute = workdayStart;
        continue;
      }

      if (localMinute < workdayStart) localMinute = workdayStart;
      if (localMinute >= workdayEnd) {
        localDate = this.addLocalDays(localDate, 1);
        localMinute = workdayStart;
        continue;
      }

      const availableMinutes = workdayEnd - localMinute;
      if (remainingMinutes <= availableMinutes) {
        return {
          configured: true,
          dueAt: this.localDateTimeToUtc(
            localDate,
            localMinute + remainingMinutes,
            settings.timezone,
          ).toISOString(),
        };
      }

      remainingMinutes -= availableMinutes;
      localDate = this.addLocalDays(localDate, 1);
      localMinute = workdayStart;
    }

    return {
      configured: false,
      dueAt: null,
      reason: 'WORK_CALENDAR_RANGE_EXCEEDED',
    };
  }
}
