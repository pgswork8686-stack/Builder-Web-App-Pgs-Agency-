/**
 * REAL-SERVICE AUTHORIZATION TESTS: SettingsService
 */
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestUser } from '../auth/auth.types';

const USER_ID = '33333333-3333-4333-8333-333333333333';

function makeUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    authUserId: '00000000-0000-0000-0000-000000000001',
    profileId: USER_ID,
    email: 'user@test.com',
    phone: null,
    accountStatus: 'active',
    role: 'employee',
    fullName: 'Employee User',
    avatarUrl: null,
    approvedAt: null,
    ...overrides,
  };
}

function mockQueryChain(response: { data: any; error: any }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
    upsert: jest.fn().mockReturnThis(),
    then: (resolve: (value: any) => any, reject?: (err: any) => any) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return chain;
}

describe('SettingsService — Real Authorization Logic', () => {
  let service: SettingsService;
  let fromMock: jest.Mock;

  beforeEach(async () => {
    fromMock = jest.fn();

    const mockSupabaseService = {
      getSystemClient: jest.fn().mockReturnValue({
        from: fromMock,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('Admin-Only Setting Restrictions', () => {
    it('throws ForbiddenException when employee tries to get settings', async () => {
      const employeeUser = makeUser({ role: 'employee' });
      await expect(service.getAllSettings(employeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when accountant tries to update settings', async () => {
      const accountantUser = makeUser({ role: 'accountant' });
      await expect(
        service.updateSetting(
          {
            key: 'company_info',
            category: 'general',
            value: { name: 'PGS Agency' },
          },
          accountantUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to fetch all settings', async () => {
      const adminUser = makeUser({ role: 'admin' });
      fromMock.mockReturnValueOnce(
        mockQueryChain({
          data: [{ key: 'company_info', category: 'general', value: {} }],
          error: null,
        }),
      );

      const result = await service.getAllSettings(adminUser);
      expect(result.length).toBe(1);
    });
  });
});
