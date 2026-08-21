import { UpdateAttendanceSettingsSchema } from './attendance.dto';

describe('UpdateAttendanceSettingsSchema', () => {
  it('accepts and normalizes real attendance_settings policy fields', () => {
    const result = UpdateAttendanceSettingsSchema.safeParse({
      timezone: 'Asia/Ho_Chi_Minh',
      workdayStartTime: '08:00',
      workdayEndTime: '17:30:00',
      lateGraceMinutes: 5,
      earlyLeaveGraceMinutes: 5,
      locationRequired: true,
      photoRequired: false,
      locationRadiusMeters: 100,
      officeLatitude: 20.9768,
      officeLongitude: 105.7725,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workdayStartTime).toBe('08:00:00');
    }
  });

  it('preserves explicit nullable policy values', () => {
    const result = UpdateAttendanceSettingsSchema.safeParse({
      workdayStartTime: null,
      workdayEndTime: null,
      lateGraceMinutes: null,
      earlyLeaveGraceMinutes: null,
      locationRadiusMeters: null,
      officeLatitude: null,
      officeLongitude: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown or legacy database-shaped fields', () => {
    expect(
      UpdateAttendanceSettingsSchema.safeParse({
        workday_start_time: '08:00:00',
      }).success,
    ).toBe(false);
    expect(UpdateAttendanceSettingsSchema.safeParse({}).success).toBe(false);
  });

  it('rejects incoherent time and GPS pairs supplied together', () => {
    expect(
      UpdateAttendanceSettingsSchema.safeParse({
        workdayStartTime: '17:30',
        workdayEndTime: '08:00',
      }).success,
    ).toBe(false);
    expect(
      UpdateAttendanceSettingsSchema.safeParse({
        officeLatitude: 20.9768,
        officeLongitude: null,
      }).success,
    ).toBe(false);
  });
});
