import { Injectable, Logger } from '@nestjs/common';
import { WorkCalendarService } from '../work-calendar/work-calendar.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface SlaCalculationResult {
  configured: boolean;
  dueAt: string | null;
  reason?: string;
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

  private getVietnamDateString(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  async calculateDueAt(
    startDate: Date,
    slaHours: number,
    mockSettings?: {
      workday_start_time?: string | null;
      workday_end_time?: string | null;
      timezone?: string;
    },
  ): Promise<SlaCalculationResult> {
    if (!slaHours || slaHours <= 0) {
      return { configured: true, dueAt: null };
    }

    let settings = mockSettings;
    if (!settings) {
      const { data } = await this.client
        .from('attendance_settings')
        .select('workday_start_time, workday_end_time, timezone')
        .limit(1)
        .maybeSingle();
      settings = data || undefined;
    }

    if (!settings?.workday_start_time || !settings?.workday_end_time) {
      return {
        configured: false,
        dueAt: null,
        reason: 'WORK_HOURS_NOT_CONFIGURED',
      };
    }

    const [startH, startM] = settings.workday_start_time.split(':').map(Number);
    const [endH, endM] = settings.workday_end_time.split(':').map(Number);
    const dailyWorkingMinutes = endH * 60 + endM - (startH * 60 + startM);
    if (dailyWorkingMinutes <= 0) {
      return { configured: false, dueAt: null, reason: 'INVALID_WORK_HOURS' };
    }

    let remainingMinutes = slaHours * 60;
    let currentDate = new Date(startDate.getTime());

    let maxDays = 90;
    while (remainingMinutes > 0 && maxDays > 0) {
      maxDays--;
      const dateStr = this.getVietnamDateString(currentDate);
      const dayInfo = await this.workCalendarService.resolveDay(dateStr);

      if (dayInfo.isWorkingDay) {
        if (remainingMinutes <= dailyWorkingMinutes) {
          const finalDate = new Date(
            currentDate.getTime() + remainingMinutes * 60 * 1000,
          );
          return {
            configured: true,
            dueAt: finalDate.toISOString(),
          };
        } else {
          remainingMinutes -= dailyWorkingMinutes;
        }
      }

      // Advance to next day at workday start (01:00 UTC = 08:00 VN time)
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      currentDate.setUTCHours(1, 0, 0, 0);
    }

    return {
      configured: true,
      dueAt: currentDate.toISOString(),
    };
  }
}
