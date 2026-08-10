import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { RequestUser } from './auth.types';

describe('AuthService', () => {
  let service: AuthService;

  const mockSupabaseClient = {
    auth: {
      admin: {
        getUserById: jest.fn(),
      },
    },
    from: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            initialAdminEmail: 'pgsword6868@gmail.com',
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('getMe', () => {
    it('should return user profile and auth info', async () => {
      const mockProfile = {
        id: 'u1',
        role: 'employee',
        account_status: 'active',
        full_name: 'John Doe',
        avatar_url: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });
      const eqMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'john@example.com' } },
        error: null,
      });

      const result = await service.getMe('u1');

      expect(result).toEqual({
        id: 'u1',
        email: 'john@example.com',
        role: 'employee',
        account_status: 'active',
        full_name: 'John Doe',
        avatar_url: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });
    });
  });

  describe('bootstrapAdmin', () => {
    it('should throw ForbiddenException if email does not match initial admin email', async () => {
      const user: RequestUser = {
        id: 'u1',
        email: 'other@example.com',
        role: null,
        account_status: 'pending',
      };

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if user status is not pending', async () => {
      const user: RequestUser = {
        id: 'u1',
        email: 'pgsword6868@gmail.com',
        role: 'employee',
        account_status: 'active',
      };

      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'active' },
        error: null,
      });
      const eqMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if active admin already exists', async () => {
      const user: RequestUser = {
        id: 'u1',
        email: 'pgsword6868@gmail.com',
        role: null,
        account_status: 'pending',
      };

      // 1st call for user profile
      const userProfileMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'pending' },
        error: null,
      });
      const eqUserMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: userProfileMock });

      // 2nd call for existing admin check
      const adminProfileMock = jest.fn().mockResolvedValue({
        data: { id: 'u2', role: 'admin', account_status: 'active' },
        error: null,
      });
      const eqAdminStatusMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: adminProfileMock });
      const eqAdminRoleMock = jest
        .fn()
        .mockReturnValue({ eq: eqAdminStatusMock });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockImplementation((cols: string) => {
              if (cols === '*') return { eq: eqUserMock };
              return { eq: eqAdminRoleMock };
            }),
          };
        }
        return {};
      });

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully bootstrap admin, update profile, and insert approval event', async () => {
      const user: RequestUser = {
        id: 'u1',
        email: 'pgsword6868@gmail.com',
        role: null,
        account_status: 'pending',
      };

      const userProfileMock = jest.fn().mockResolvedValue({
        data: { id: 'u1', account_status: 'pending' },
        error: null,
      });
      const eqUserMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: userProfileMock });

      const adminProfileMock = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqAdminStatusMock = jest
        .fn()
        .mockReturnValue({ maybeSingle: adminProfileMock });
      const eqAdminRoleMock = jest
        .fn()
        .mockReturnValue({ eq: eqAdminStatusMock });

      const singleUpdateMock = jest.fn().mockResolvedValue({
        data: {
          id: 'u1',
          role: 'admin',
          account_status: 'active',
          full_name: 'Bao Phung',
          avatar_url: null,
        },
        error: null,
      });
      const selectUpdateMock = jest
        .fn()
        .mockReturnValue({ single: singleUpdateMock });
      const eqUpdateMock = jest
        .fn()
        .mockReturnValue({ select: selectUpdateMock });
      const updateMock = jest.fn().mockReturnValue({ eq: eqUpdateMock });

      const insertEventMock = jest.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockImplementation((cols: string) => {
              if (cols === '*') return { eq: eqUserMock };
              return { eq: eqAdminRoleMock };
            }),
            update: updateMock,
          };
        }
        if (table === 'account_approval_events') {
          return {
            insert: insertEventMock,
          };
        }
        return {};
      });

      const result = await service.bootstrapAdmin(user);

      expect(result.user.role).toBe('admin');
      expect(result.user.account_status).toBe('active');
      expect(insertEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          target_user_id: 'u1',
          actor_id: 'u1',
          action: 'bootstrap_admin',
          new_role: 'admin',
          new_status: 'active',
        }),
      );
    });
  });
});
