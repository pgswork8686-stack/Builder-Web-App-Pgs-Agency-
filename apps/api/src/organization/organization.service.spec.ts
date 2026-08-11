import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDepartment', () => {
    it('should throw ConflictException if department code already exists', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'd1', code: 'SEO' },
          error: null,
        }),
      }));

      await expect(
        service.createDepartment({ code: 'SEO', name: 'SEO Dept' }, 'admin-u1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createTeam', () => {
    it('should throw BadRequestException if team leader role is not team_leader', async () => {
      // Mock department exists
      // Mock team code doesn't exist
      // Mock profiles lookup returns user with employee role
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'departments') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: { id: 'dept-1' }, error: null }),
          };
        }
        if (table === 'teams') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: null, error: null }),
          };
        }
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
        return {};
      });

      await expect(
        service.createTeam(
          {
            departmentId: 'dept-1',
            code: 'TEAM-A',
            name: 'Team A',
            leaderUserId: 'user-emp-1',
          },
          'admin-u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
