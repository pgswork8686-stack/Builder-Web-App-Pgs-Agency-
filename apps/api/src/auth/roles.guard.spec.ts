import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestUser } from './auth.types';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
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

  it('should pass if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException if required role is set but user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const context = createMockContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if user status is pending', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const user: RequestUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      account_status: 'pending',
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('ACCOUNT_PENDING'),
    );
  });

  it('should throw ForbiddenException if user role does not match required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const user: RequestUser = {
      id: '1',
      email: 'emp@test.com',
      role: 'employee',
      account_status: 'active',
    };
    const context = createMockContext(user);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('should allow access if user is active and has required admin role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const user: RequestUser = {
      id: '1',
      email: 'admin@test.com',
      role: 'admin',
      account_status: 'active',
    };
    const context = createMockContext(user);

    expect(guard.canActivate(context)).toBe(true);
  });
});
