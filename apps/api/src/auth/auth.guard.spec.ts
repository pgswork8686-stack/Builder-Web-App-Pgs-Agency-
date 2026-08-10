import { ExecutionContext, UnauthorizedException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let reflector: Reflector;

  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
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
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get<Reflector>(Reflector);
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
    mockSupabaseClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');
    const request = context.switchToHttp().getRequest();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      authUserId: 'user-123',
      profileId: 'user-123',
      email: 'test@example.com',
      role: 'employee',
      accountStatus: 'active',
      fullName: 'Test User',
      avatarUrl: null,
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
    mockSupabaseClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw InternalServerErrorException if database query fails', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('DB connection fail'),
    });
    const eqMock = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    mockSupabaseClient.from.mockReturnValue({ select: selectMock });

    const context = createMockContext('Bearer valid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
