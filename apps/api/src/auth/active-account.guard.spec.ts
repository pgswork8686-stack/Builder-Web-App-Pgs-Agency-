import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ActiveAccountGuard } from './active-account.guard';
import { RequestUser } from './auth.types';

describe('ActiveAccountGuard', () => {
  let guard: ActiveAccountGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveAccountGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<ActiveAccountGuard>(ActiveAccountGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user?: RequestUser): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should pass for public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException if user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException(ACCOUNT_PENDING) for pending users', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const user: RequestUser = {
      authUserId: '1',
      profileId: '1',
      email: 'p@test.com',
      phone: null,
      role: null,
      accountStatus: 'pending',
      fullName: null,
      avatarUrl: null,
      approvedAt: null,
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('ACCOUNT_PENDING'),
    );
  });

  it('should throw ForbiddenException(ACCOUNT_REJECTED) for rejected users', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const user: RequestUser = {
      authUserId: '1',
      profileId: '1',
      email: 'r@test.com',
      phone: null,
      role: null,
      accountStatus: 'rejected',
      fullName: null,
      avatarUrl: null,
      approvedAt: null,
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('ACCOUNT_REJECTED'),
    );
  });

  it('should allow access for active users', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const user: RequestUser = {
      authUserId: '1',
      profileId: '1',
      email: 'a@test.com',
      phone: null,
      role: 'employee',
      accountStatus: 'active',
      fullName: null,
      avatarUrl: null,
      approvedAt: null,
    };
    const context = createMockContext(user);

    expect(guard.canActivate(context)).toBe(true);
  });
});
