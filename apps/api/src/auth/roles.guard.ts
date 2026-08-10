import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole, RequestUser } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.accountStatus === 'pending') {
      throw new ForbiddenException('ACCOUNT_PENDING');
    }

    if (user.accountStatus === 'rejected') {
      throw new ForbiddenException('ACCOUNT_REJECTED');
    }

    if (user.accountStatus !== 'active') {
      throw new ForbiddenException('ACCOUNT_INACTIVE');
    }

    if (user.role && requiredRoles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
