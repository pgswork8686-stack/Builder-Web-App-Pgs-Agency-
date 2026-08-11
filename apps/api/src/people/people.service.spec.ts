import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeopleService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<PeopleService>(PeopleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmploymentProfile', () => {
    it('should throw BadRequestException if user role is client', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: 'client', account_status: 'active' },
              error: null,
            }),
          };
        }
        return {};
      });

      await expect(
        service.createEmploymentProfile(
          'user-client-1',
          {
            employeeCode: 'EMP001',
            employmentStatus: 'active',
          },
          'admin-u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reportsToUserId equals userId', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { role: 'employee', account_status: 'active' },
              error: null,
            }),
          };
        }
        if (table === 'employee_profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      await expect(
        service.createEmploymentProfile(
          'user-emp-1',
          {
            employeeCode: 'EMP001',
            reportsToUserId: 'user-emp-1',
            employmentStatus: 'active',
          },
          'admin-u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
