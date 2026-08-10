import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    return data ? user?.[data] : user;
  },
);
