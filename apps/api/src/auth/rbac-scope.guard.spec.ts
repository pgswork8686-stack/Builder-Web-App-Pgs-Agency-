import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionGuard } from './permission.guard';
import { ScopeGuard } from './scope.guard';

describe('RBAC Guards (PermissionGuard & ScopeGuard)', () => {
  let permissionGuard: PermissionGuard;
  let scopeGuard: ScopeGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        ScopeGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    permissionGuard = module.get<PermissionGuard>(PermissionGuard);
    scopeGuard = module.get<ScopeGuard>(ScopeGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('PermissionGuard', () => {
    it('should allow if no permissions required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext();
      expect(permissionGuard.canActivate(context)).toBe(true);
    });

    it('should throw UnauthorizedException if unauthenticated', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['projects:create']);
      const context = createMockContext(undefined);
      expect(() => permissionGuard.canActivate(context)).toThrow(
        UnauthorizedException,
      );
    });

    it('should allow admin to perform any mapped action', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['projects:create', 'users:manage']);
      const context = createMockContext({
        authUserId: 'u1',
        role: 'admin',
        accountStatus: 'active',
      });
      expect(permissionGuard.canActivate(context)).toBe(true);
    });

    it('should block employee from creating projects', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['projects:create']);
      const context = createMockContext({
        authUserId: 'u2',
        role: 'employee',
        accountStatus: 'active',
      });
      expect(() => permissionGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });

    it('should allow team leader to create projects but block managing users', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['projects:create']);
      const context = createMockContext({
        authUserId: 'u3',
        role: 'team_leader',
        accountStatus: 'active',
      });
      expect(permissionGuard.canActivate(context)).toBe(true);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['users:manage']);
      expect(() => permissionGuard.canActivate(context)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('ScopeGuard', () => {
    it('should allow if no scope required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext();
      expect(scopeGuard.canActivate(context)).toBe(true);
    });

    it('should always allow admin regardless of department', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('department');
      const context = createMockContext({
        authUserId: 'u1',
        role: 'admin',
        accountStatus: 'active',
        departmentId: null,
      });
      expect(scopeGuard.canActivate(context)).toBe(true);
    });

    it('should allow team leader with assigned department', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('department');
      const context = createMockContext({
        authUserId: 'u3',
        role: 'team_leader',
        accountStatus: 'active',
        departmentId: 'dept-123',
      });
      expect(scopeGuard.canActivate(context)).toBe(true);
    });

    it('should block team leader without assigned department', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('department');
      const context = createMockContext({
        authUserId: 'u3',
        role: 'team_leader',
        accountStatus: 'active',
        departmentId: null,
      });
      expect(() => scopeGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should block employee from department-scoped management route', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('department');
      const context = createMockContext({
        authUserId: 'u2',
        role: 'employee',
        accountStatus: 'active',
        departmentId: 'dept-123',
      });
      expect(() => scopeGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
