import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole, RequestUser } from './auth.types';
import { PERMISSIONS_KEY } from './permission.decorator';
import { AppPermission } from './permissions.types';

export const ROLE_PERMISSIONS_MAP: Record<AppRole, AppPermission[]> = {
  admin: [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'projects:manage_members',
    'tasks:create',
    'tasks:assign',
    'tasks:update',
    'tasks:delete',
    'attendance:check_in',
    'attendance:read',
    'attendance:manage',
    'leave:apply',
    'leave:approve',
    'finance:read',
    'finance:manage',
    'services:read',
    'services:manage',
    'users:manage',
    'settings:manage',
  ],
  team_leader: [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:manage_members',
    'tasks:create',
    'tasks:assign',
    'tasks:update',
    'tasks:delete',
    'attendance:check_in',
    'attendance:read',
    'leave:apply',
    'leave:approve',
    'services:read',
  ],
  employee: [
    'projects:read',
    'tasks:update',
    'attendance:check_in',
    'attendance:read',
    'leave:apply',
    'services:read',
  ],
  accountant: [
    'projects:read',
    'attendance:read',
    'leave:apply',
    'finance:read',
    'finance:manage',
    'services:read',
  ],
  client: ['projects:read', 'finance:read', 'services:read'],
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      AppPermission[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.accountStatus !== 'active') {
      throw new ForbiddenException('ACCOUNT_INACTIVE');
    }

    if (!user.role) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
    }

    const grantedPermissions = ROLE_PERMISSIONS_MAP[user.role] || [];
    const hasAll = requiredPermissions.every((perm) =>
      grantedPermissions.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
    }

    return true;
  }
}
