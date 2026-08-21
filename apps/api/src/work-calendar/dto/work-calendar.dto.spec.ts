import {
  UpdateWorkCalendarEventSchema,
  UpdateWorkCalendarSettingsSchema,
} from './work-calendar.dto';

describe('Work Calendar DTO production schema alignment', () => {
  it('accepts ISO Sunday=7 and rejects legacy Sunday=0', () => {
    expect(
      UpdateWorkCalendarSettingsSchema.safeParse({ weekdayWorkingDays: [1, 7] })
        .success,
    ).toBe(true);
    expect(
      UpdateWorkCalendarSettingsSchema.safeParse({ weekdayWorkingDays: [0, 1] })
        .success,
    ).toBe(false);
  });

  it('accepts Production event statuses only', () => {
    expect(
      UpdateWorkCalendarEventSchema.safeParse({ status: 'ignored' }).success,
    ).toBe(true);
    expect(
      UpdateWorkCalendarEventSchema.safeParse({ status: 'cancelled' }).success,
    ).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(
      UpdateWorkCalendarEventSchema.safeParse({ eventDate: '2026-02-31' })
        .success,
    ).toBe(false);
  });
});
