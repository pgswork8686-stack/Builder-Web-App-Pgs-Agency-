import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from './auth.types';
import { SCOPE_KEY, ScopeType } from './scope.decorator';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<ScopeType>(
      SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Admin bypasses all scope restrictions
    if (user.role === 'admin') {
      return true;
    }

    if (requiredScope === 'department') {
      // For department-scoped resources, team_leader/manager must have departmentId
      if (user.role === 'team_leader') {
        if (!user.departmentId) {
          throw new ForbiddenException('NO_DEPARTMENT_ASSIGNED');
        }
        return true;
      }
      // Employee or client cannot access manager department-scoped actions
      throw new ForbiddenException('INSUFFICIENT_SCOPE');
    }

    return true;
  }
}
