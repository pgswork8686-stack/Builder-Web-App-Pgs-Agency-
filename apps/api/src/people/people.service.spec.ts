import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    function mockCreateDependencies(
      team: {
        id: string;
        department_id: string;
      } | null,
    ) {
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
        if (table === 'teams') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: team,
              error: null,
            }),
          };
        }
        return {};
      });
    }

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

    it('should reject a team assignment without departmentId', async () => {
      mockCreateDependencies({ id: 'team-a', department_id: 'dept-a' });

      await expect(
        service.createEmploymentProfile(
          'user-emp-1',
          {
            employeeCode: 'EMP001',
            teamId: 'team-a',
            employmentStatus: 'active',
          },
          'admin-u1',
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'INVALID_TEAM_DEPARTMENT',
          message: 'Phải chọn phòng ban phù hợp khi gán đội nhóm.',
        },
        status: 400,
      });
    });

    it('should return 404 when the selected team does not exist', async () => {
      mockCreateDependencies(null);

      await expect(
        service.createEmploymentProfile(
          'user-emp-1',
          {
            employeeCode: 'EMP001',
            departmentId: 'dept-a',
            teamId: 'missing-team',
            employmentStatus: 'active',
          },
          'admin-u1',
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'TEAM_NOT_FOUND',
          message: 'Không tìm thấy đội nhóm được chọn.',
        },
        status: 404,
      });
    });

    it('should reject a team from another department', async () => {
      mockCreateDependencies({ id: 'team-a', department_id: 'dept-a' });

      await expect(
        service.createEmploymentProfile(
          'user-emp-1',
          {
            employeeCode: 'EMP001',
            departmentId: 'dept-b',
            teamId: 'team-a',
            employmentStatus: 'active',
          },
          'admin-u1',
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TEAM_DEPARTMENT' },
        status: 400,
      });
    });
  });

  describe('updateEmploymentProfile', () => {
    const currentPerson: Awaited<
      ReturnType<PeopleService['getPersonByUserId']>
    > = {
      id: 'user-emp-1',
      email: null,
      phone: null,
      fullName: 'Employee One',
      avatarUrl: null,
      role: 'employee',
      accountStatus: 'active',
      employeeProfile: {
        employeeCode: 'EMP001',
        teamId: 'team-a',
        teamName: 'Team A',
        departmentId: 'dept-a',
        departmentName: 'Department A',
        jobTitle: null,
        reportsToUserId: null,
        reportsToFullName: null,
        employmentStatus: 'active',
        joinedDate: null,
        leftDate: null,
      },
    };

    it('should reject clearing departmentId while the current team remains', async () => {
      jest.spyOn(service, 'getPersonByUserId').mockResolvedValue(currentPerson);

      await expect(
        service.updateEmploymentProfile(
          'user-emp-1',
          { departmentId: null },
          'admin-u1',
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_TEAM_DEPARTMENT' },
        status: 400,
      });
    });

    it('should allow clearing teamId and departmentId together', async () => {
      jest.spyOn(service, 'getPersonByUserId').mockResolvedValue(currentPerson);

      const update = jest.fn().mockReturnThis();
      const eq = jest.fn().mockReturnThis();
      const select = jest.fn().mockReturnThis();
      const single = jest.fn().mockResolvedValue({
        data: { user_id: 'user-emp-1', team_id: null, department_id: null },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'employee_profiles' ? { update, eq, select, single } : {},
      );

      await expect(
        service.updateEmploymentProfile(
          'user-emp-1',
          { teamId: null, departmentId: null },
          'admin-u1',
        ),
      ).resolves.toMatchObject({
        user_id: 'user-emp-1',
        team_id: null,
        department_id: null,
      });

      expect(update).toHaveBeenCalledWith({
        updated_by: 'admin-u1',
        department_id: null,
        team_id: null,
      });
    });

    it('should return NotFoundException for a missing effective team', async () => {
      jest.spyOn(service, 'getPersonByUserId').mockResolvedValue(currentPerson);

      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'teams'
          ? {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }
          : {},
      );

      await expect(
        service.updateEmploymentProfile(
          'user-emp-1',
          { teamId: 'missing-team' },
          'admin-u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
