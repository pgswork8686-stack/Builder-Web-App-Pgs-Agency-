import { request } from "./client";

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

export interface WorkCalendarSettings {
  id: string;
  timezone: string;
  weekday_working_days: number[];
  alternate_saturday_enabled: boolean;
  alternate_saturday_anchor_date: string | null;
  alternate_saturday_anchor_is_working: boolean;
  apply_government_makeup_days: boolean;
  holiday_country_code: string;
  holiday_provider: string | null;
  auto_holiday_sync_enabled: boolean;
  last_holiday_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkCalendarEvent {
  id: string;
  event_date: string;
  event_type:
    "public_holiday" | "company_holiday" | "makeup_workday" | "special_workday";
  title: string;
  is_working_day: boolean;
  source_type: "manual" | "api" | "government_notice" | "system";
  source_provider: string | null;
  notes: string | null;
  status: "pending" | "active" | "ignored";
  created_at: string;
  updated_at: string;
}

export const workCalendarApi = {
  range: (from: string, to: string): Promise<WorkCalendarRangeResponse> => {
    return request<WorkCalendarRangeResponse>(
      `/work-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  },

  getSettings: (): Promise<WorkCalendarSettings> => {
    return request<WorkCalendarSettings>("/admin/work-calendar/settings");
  },

  updateSettings: (
    data: Partial<{
      timezone: string;
      weekdayWorkingDays: number[];
      alternateSaturdayEnabled: boolean;
      alternateSaturdayAnchorDate: string | null;
      alternateSaturdayAnchorIsWorking: boolean;
      applyGovernmentMakeupDays: boolean;
      holidayCountryCode: string;
      holidayProvider: string | null;
      autoHolidaySyncEnabled: boolean;
    }>,
  ): Promise<WorkCalendarSettings> => {
    return request<WorkCalendarSettings>("/admin/work-calendar/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getEvents: (from?: string, to?: string): Promise<WorkCalendarEvent[]> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return request<WorkCalendarEvent[]>(
      `/admin/work-calendar/events${qs ? `?${qs}` : ""}`,
    );
  },

  createEvent: (data: {
    eventDate: string;
    eventType:
      | "public_holiday"
      | "company_holiday"
      | "makeup_workday"
      | "special_workday";
    title: string;
    isWorkingDay: boolean;
    notes?: string | null;
  }): Promise<WorkCalendarEvent> => {
    return request<WorkCalendarEvent>("/admin/work-calendar/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateEvent: (
    eventId: string,
    data: Partial<{
      eventDate: string;
      eventType:
        | "public_holiday"
        | "company_holiday"
        | "makeup_workday"
        | "special_workday";
      title: string;
      isWorkingDay: boolean;
      notes: string | null;
      status: "pending" | "active" | "ignored";
    }>,
  ): Promise<WorkCalendarEvent> => {
    return request<WorkCalendarEvent>(
      `/admin/work-calendar/events/${eventId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  },

  deleteEvent: (
    eventId: string,
  ): Promise<{ success: boolean; deletedEvent: WorkCalendarEvent }> => {
    return request<{ success: boolean; deletedEvent: WorkCalendarEvent }>(
      `/admin/work-calendar/events/${eventId}`,
      {
        method: "DELETE",
      },
    );
  },

  syncHolidays: (
    year?: number,
  ): Promise<{
    success: boolean;
    year: number;
    country: string;
    totalProviderHolidays: number;
    syncedCount: number;
    lastHolidaySyncAt: string;
  }> => {
    return request("/admin/work-calendar/sync-holidays", {
      method: "POST",
      body: JSON.stringify({ year: year ?? new Date().getFullYear() }),
    });
  },
};
