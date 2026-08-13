import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { RequestUser } from './auth.types';

describe('AuthService', () => {
  let service: AuthService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        admin: {
          getUserById: jest.fn(),
        },
      },
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: jest.fn(),
    };

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
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'john@example.com',
        phone: null,
        role: 'employee',
        accountStatus: 'active',
        fullName: 'John Doe',
        avatarUrl: null,
        approvedAt: '2026-01-02',
      };

      const result = await service.getMe(user);

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
          rejectionReason: null,
        },
        canBootstrapAdmin: false,
      });
    });

    it('should throw InternalServerErrorException and fail-closed if global admin check fails', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'pgsword6868@gmail.com',
        phone: null,
        role: null,
        accountStatus: 'pending',
        fullName: 'Initial Admin Spec',
        avatarUrl: null,
        approvedAt: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Postgres connection pool exhausted'),
        }),
      }));

      let thrownError: any;
      try {
        await service.getMe(user);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(InternalServerErrorException);
      expect(thrownError.getResponse()).toEqual({
        code: 'ADMIN_STATE_LOOKUP_FAILED',
        message: 'Không thể kiểm tra trạng thái quản trị hệ thống lúc này.',
      });
    });
  });

  describe('bootstrapAdmin', () => {
    it('should throw ForbiddenException if email does not match initial admin email', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'other@example.com',
        phone: null,
        role: null,
        accountStatus: 'pending',
        fullName: null,
        avatarUrl: null,
        approvedAt: null,
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
        phone: null,
        role: null,
        accountStatus: 'pending',
        fullName: null,
        avatarUrl: null,
        approvedAt: null,
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'pgsword6868@gmail.com',
            email_confirmed_at: null,
          },
        },
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
        phone: null,
        role: null,
        accountStatus: 'pending',
        fullName: null,
        avatarUrl: null,
        approvedAt: null,
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'pgsword6868@gmail.com',
            email_confirmed_at: '2026-01-01',
          },
        },
        error: null,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: { role: 'admin', status: 'active' },
        error: null,
      });

      const result = await service.bootstrapAdmin(user);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'bootstrap_initial_admin',
        {
          p_admin_user_id: 'u1',
        },
      );
      expect(result.user.role).toBe('admin');
      expect(result.user.account_status).toBe('active');
    });

    it('should throw ConflictException if RPC returns code P0002', async () => {
      const user: RequestUser = {
        authUserId: 'u1',
        profileId: 'u1',
        email: 'pgsword6868@gmail.com',
        phone: null,
        role: null,
        accountStatus: 'pending',
        fullName: null,
        avatarUrl: null,
        approvedAt: null,
      };

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'pgsword6868@gmail.com',
            email_confirmed_at: '2026-01-01',
          },
        },
        error: null,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: {
          code: 'P0002',
          message: 'System already has bootstrapped admin',
        },
      });

      await expect(service.bootstrapAdmin(user)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
