import { ExecutionContext, UnauthorizedException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  const mockUserClient = {
    from: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getSystemClient: jest.fn().mockReturnValue(mockSupabaseClient),
            createUserClient: jest.fn().mockReturnValue(mockUserClient),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get<Reflector>(Reflector);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if endpoint is @Public() and no header is provided', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if non-public endpoint has no authorization header', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if token is invalid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid token'),
    });

    const context = createMockContext('Bearer invalid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should attach user payload to request and return true for valid token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = {
      id: 'user-123',
      role: 'employee',
      account_status: 'active',
      full_name: 'Test User',
      avatar_url: null,
      approved_at: '2026-01-02',
    };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    mockUserClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');
    const request = context.switchToHttp().getRequest();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(supabaseService.createUserClient).toHaveBeenCalledWith('valid_token');
    expect(supabaseService.getSystemClient).toHaveBeenCalled();
    expect(request.user).toEqual({
      authUserId: 'user-123',
      profileId: 'user-123',
      email: 'test@example.com',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Test User',
      avatarUrl: null,
      approvedAt: '2026-01-02',
    });
  });

  it('should throw ForbiddenException if user profile is missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    mockUserClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException if user status is invalid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = {
      id: 'user-123',
      role: 'employee',
      account_status: 'invalid_status_here',
      full_name: 'Test User',
      avatar_url: null,
    };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    mockUserClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('ACCOUNT_STATE_INVALID'),
    );
  });

  it('should throw sanitized InternalServerErrorException if database query fails', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('relation "profiles" does not exist'),
    });
    const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    mockUserClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      InternalServerErrorException,
    );

    try {
      await guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'PROFILE_LOOKUP_FAILED',
        message: 'Không thể kiểm tra thông tin tài khoản lúc này.',
      });
      expect(err.message).not.toContain('relation "profiles" does not exist');
    }
  });
});
