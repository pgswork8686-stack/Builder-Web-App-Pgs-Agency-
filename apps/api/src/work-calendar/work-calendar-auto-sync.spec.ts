import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkCalendarService } from './work-calendar.service';

describe('WorkCalendarService automatic holiday sync', () => {
  let service: WorkCalendarService;
  let configMock: { appEnv: string; calendarificApiKey?: string };

  beforeEach(async () => {
    configMock = {
      appEnv: 'test',
      calendarificApiKey: 'test-key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkCalendarService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue({
              rpc: jest.fn(),
              from: jest.fn(),
            }),
          },
        },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(WorkCalendarService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips automatic sync when the company setting is disabled', async () => {
    jest.spyOn(service, 'getSettings').mockResolvedValue({
      auto_holiday_sync_enabled: false,
    } as any);

    await expect(
      service.runAutoHolidaySync(new Date('2026-08-20T00:00:00Z')),
    ).resolves.toEqual({ status: 'skipped', reason: 'disabled' });
  });

  it('skips safely when auto sync is enabled but provider key is missing', async () => {
    configMock.calendarificApiKey = undefined;
    jest.spyOn(service, 'getSettings').mockResolvedValue({
      auto_holiday_sync_enabled: true,
      holiday_provider: 'calendarific',
      timezone: 'Asia/Ho_Chi_Minh',
      holiday_country_code: 'VN',
    } as any);

    await expect(
      service.runAutoHolidaySync(new Date('2026-08-20T00:00:00Z')),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'provider_not_configured',
    });
  });

  it('does not call the provider again when the current year was synced recently', async () => {
    jest.spyOn(service, 'getSettings').mockResolvedValue({
      id: 'settings-1',
      auto_holiday_sync_enabled: true,
      holiday_provider: 'calendarific',
      timezone: 'Asia/Ho_Chi_Minh',
      holiday_country_code: 'VN',
    } as any);
    jest
      .spyOn(service as any, 'wasHolidayYearSyncedRecently')
      .mockResolvedValue(true);
    const syncSpy = jest.spyOn(service as any, 'syncHolidaysForYear');

    await expect(
      service.runAutoHolidaySync(new Date('2026-08-20T00:00:00Z')),
    ).resolves.toEqual({ status: 'skipped', reason: 'fresh', year: 2026 });
    expect(syncSpy).not.toHaveBeenCalled();
  });
});
