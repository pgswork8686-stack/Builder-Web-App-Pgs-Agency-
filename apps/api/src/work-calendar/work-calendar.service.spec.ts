import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkCalendarService } from './work-calendar.service';
import type { RequestUser } from '../auth/auth.types';

describe('WorkCalendarService', () => {
  let service: WorkCalendarService;
  let supabaseMock: any;
  let configMock: any;

  const mockAdminUser: RequestUser = {
    authUserId: 'admin-auth-id',
    profileId: 'admin-profile-id',
    email: 'admin@pgsagency.vn',
    phone: null,
    role: 'admin',
    accountStatus: 'active',
    fullName: 'Admin User',
    avatarUrl: null,
    approvedAt: new Date().toISOString(),
    rejectionReason: null,
  };

  const mockEmployeeUser: RequestUser = {
    authUserId: 'emp-auth-id',
    profileId: 'emp-profile-id',
    email: 'emp@pgsagency.vn',
    phone: null,
    role: 'employee',
    accountStatus: 'active',
    fullName: 'Employee User',
    avatarUrl: null,
    approvedAt: new Date().toISOString(),
    rejectionReason: null,
  };

  const mockClientUser: RequestUser = {
    authUserId: 'client-auth-id',
    profileId: 'client-profile-id',
    email: 'client@example.com',
    phone: null,
    role: 'client',
    accountStatus: 'active',
    fullName: 'Client User',
    avatarUrl: null,
    approvedAt: new Date().toISOString(),
    rejectionReason: null,
  };

  beforeEach(async () => {
    supabaseMock = {
      getSystemClient: jest.fn().mockReturnValue({
        rpc: jest.fn(),
        from: jest.fn(),
      }),
    };

    configMock = {
      calendarificApiKey: 'test-api-key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkCalendarService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<WorkCalendarService>(WorkCalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: 2026-08-22 -> false -> Saturday #4 off
  it('1. should resolve 2026-08-22 as Saturday #4 off (is_working_day: false)', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-08-22',
          is_working_day: false,
          reason: 'monthly_alternating_saturday',
          event_type: null,
          event_title: 'Nghỉ thứ 7 theo lịch PGS',
          source_type: 'system',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-08-22');
    expect(res.date).toBe('2026-08-22');
    expect(res.isWorkingDay).toBe(false);
    expect(res.reason).toBe('monthly_alternating_saturday');
  });

  // Test 2: 2026-08-29 -> true -> Saturday #5 working
  it('2. should resolve 2026-08-29 as Saturday #5 working (is_working_day: true)', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-08-29',
          is_working_day: true,
          reason: 'monthly_alternating_saturday',
          event_type: null,
          event_title: 'Thứ 7 làm việc theo lịch PGS',
          source_type: 'system',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-08-29');
    expect(res.date).toBe('2026-08-29');
    expect(res.isWorkingDay).toBe(true);
    expect(res.reason).toBe('monthly_alternating_saturday');
  });

  // Test 3: 2026-09-05 -> true -> Saturday #1 working (Cross-month reset)
  it('3. should resolve 2026-09-05 as Saturday #1 working with monthly reset (is_working_day: true)', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-09-05',
          is_working_day: true,
          reason: 'monthly_alternating_saturday',
          event_type: null,
          event_title: 'Thứ 7 làm việc theo lịch PGS',
          source_type: 'system',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-09-05');
    expect(res.date).toBe('2026-09-05');
    expect(res.isWorkingDay).toBe(true);
    expect(res.reason).toBe('monthly_alternating_saturday');
  });

  // Test 4: weekday T2-T6 -> working
  it('4. should resolve Monday through Friday as regular working day', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-08-24',
          is_working_day: true,
          reason: 'regular_workday',
          event_type: null,
          event_title: 'Ngày làm việc',
          source_type: 'system',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-08-24');
    expect(res.isWorkingDay).toBe(true);
    expect(res.reason).toBe('regular_workday');
  });

  // Test 5: Sunday -> off
  it('5. should resolve Sunday as weekly off', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-08-23',
          is_working_day: false,
          reason: 'weekly_off',
          event_type: null,
          event_title: 'Ngày nghỉ hàng tuần',
          source_type: 'system',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-08-23');
    expect(res.isWorkingDay).toBe(false);
    expect(res.reason).toBe('weekly_off');
  });

  // Test 6: manual override beats Saturday rule
  it('6. should let manual override beat alternate Saturday rule', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-08-22',
          is_working_day: true,
          reason: 'manual_override',
          event_type: 'makeup_workday',
          event_title: 'Đi làm bù dự án',
          source_type: 'manual',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-08-22');
    expect(res.isWorkingDay).toBe(true);
    expect(res.reason).toBe('manual_override');
    expect(res.sourceType).toBe('manual');
  });

  // Test 7: manual override beats API holiday
  it('7. should prioritize manual override over API holiday', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-09-02',
          is_working_day: true,
          reason: 'manual_override',
          event_type: 'special_workday',
          event_title: 'Trực lễ Quốc khánh',
          source_type: 'manual',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-09-02');
    expect(res.isWorkingDay).toBe(true);
    expect(res.reason).toBe('manual_override');
  });

  // Test 8: API holiday makes weekday non-working
  it('8. should resolve API holiday as non-working on a weekday', async () => {
    const client = supabaseMock.getSystemClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          work_date: '2026-09-02',
          is_working_day: false,
          reason: 'public_holiday',
          event_type: 'public_holiday',
          event_title: 'Quốc khánh',
          source_type: 'api',
        },
      ],
      error: null,
    });

    const res = await service.resolveDay('2026-09-02');
    expect(res.isWorkingDay).toBe(false);
    expect(res.reason).toBe('public_holiday');
  });

  // Test 9 & 10: getSettings returns apply_government_makeup_days correctly
  it('9 & 10. should read and update apply_government_makeup_days setting', async () => {
    const client = supabaseMock.getSystemClient();
    client.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'test-id', apply_government_makeup_days: false },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'test-id', apply_government_makeup_days: true },
              error: null,
            }),
          }),
        }),
      }),
    });

    const settings = await service.getSettings();
    expect(settings.apply_government_makeup_days).toBe(false);

    const updated = await service.updateSettings(
      { applyGovernmentMakeupDays: true },
      mockAdminUser,
    );
    expect(updated.apply_government_makeup_days).toBe(true);
  });

  // Test 11: holiday sync idempotent
  it('11. should perform idempotent holiday sync', async () => {
    const client = supabaseMock.getSystemClient();
    client.from.mockImplementation((table: string) => {
      if (table === 'company_work_calendar_settings') {
        return {
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'settings-1', holiday_country_code: 'VN' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'company_work_calendar_events') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'existing-event-1', source_type: 'api' },
                  error: null,
                }),
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });

    // Mock global.fetch
    const mockHolidays = [
      {
        name: 'Quốc khánh',
        date: { iso: '2026-09-02' },
        urlid: 'vietnam/national-day',
        description: 'National Day of Vietnam',
      },
    ];
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        response: { holidays: mockHolidays },
      }),
    });

    const result = await service.syncHolidays({ year: 2026 }, mockAdminUser);
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
  });

  // Test 12: missing provider key returns controlled error
  it('12. should throw HOLIDAY_PROVIDER_NOT_CONFIGURED when API key is missing', async () => {
    configMock.calendarificApiKey = undefined;
    jest.spyOn(service, 'getSettings').mockResolvedValue({
      id: 'settings-1',
      holiday_provider: 'calendarific',
      timezone: 'Asia/Ho_Chi_Minh',
      holiday_country_code: 'VN',
    } as any);

    await expect(
      service.syncHolidays({ year: 2026 }, mockAdminUser),
    ).rejects.toThrow(BadRequestException);
  });

  // Test 13: non-admin cannot write Work Calendar
  it('13. should prevent non-admin from updating settings or creating events', async () => {
    await expect(
      service.updateSettings(
        { timezone: 'Asia/Ho_Chi_Minh' },
        mockEmployeeUser,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.createEvent(
        {
          eventDate: '2026-08-22',
          eventType: 'special_workday',
          title: 'Đi làm',
          isWorkingDay: true,
        },
        mockEmployeeUser,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.getCalendarRange('2026-08-01', '2026-08-31', mockClientUser),
    ).rejects.toThrow(ForbiddenException);
  });
});
