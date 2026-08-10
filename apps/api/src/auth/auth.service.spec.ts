import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    rpc: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
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
        approved_at: '2026-01-02',
      };

      const maybeSingleMock = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });
      const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'john@example.com' } },
        error: null,
      });

      const result = await service.getMe('u1');

      expect(result).toEqual({
        user: {
          id: 'u1',
          email: 'john@example.com',
          phone: null,
          fullName: 'John Doe',
          avatarUrl: null,
        },
        account: {
          status: 'active',
          role: 'employee',
          approvedAt: '2026-01-02',
        },
        canBootstrapAdmin: false,
      });
    });
  });

  describe('bootstrapAdmin', () => {
    it('should throw ForbiddenException if email does not match initial admin email', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'other@example.com',
        role: null,
        accountStatus: 'pending',
      };

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if email is not confirmed/verified', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'pgsword6868@gmail.com',
        role: null,
        accountStatus: 'pending',
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'pgsword6868@gmail.com', email_confirmed_at: null } },
        error: null,
      });

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully execute bootstrap_initial_admin RPC', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'pgsword6868@gmail.com',
        role: null,
        accountStatus: 'pending',
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'pgsword6868@gmail.com', email_confirmed_at: '2026-01-01' } },
        error: null,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: { role: 'admin', status: 'active' },
        error: null,
      });

      const result = await service.bootstrapAdmin(user);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('bootstrap_initial_admin', {
        p_admin_user_id: 'u1',
        p_email: 'pgsword6868@gmail.com',
      });
      expect(result.user.role).toBe('admin');
      expect(result.user.account_status).toBe('active');
    });

    it('should throw ConflictException if RPC returns code P0002', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'pgsword6868@gmail.com',
        role: null,
        accountStatus: 'pending',
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'u1', email: 'pgsword6868@gmail.com', email_confirmed_at: '2026-01-01' } },
        error: null,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { code: 'P0002', message: 'System already has bootstrapped admin' },
      });

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(ConflictException);
    });
  });
});
