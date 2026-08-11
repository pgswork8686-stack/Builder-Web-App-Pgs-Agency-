import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
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

    return true;
  }
}
