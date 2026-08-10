import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountStatus, AppRole, RequestUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const client = this.supabaseService.getSystemClient();
    const { data: authData, error: authError } =
      await client.auth.getUser(token);

    if (authError || !authData?.user) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    const user = authData.user;

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException(
        `Database profile query error: ${profileError.message}`,
      );
    }

    if (!profile) {
      throw new ForbiddenException('ACCOUNT_PROFILE_MISSING');
    }

    const requestUser: RequestUser = {
      authUserId: user.id,
      profileId: profile.id,
      email: user.email ?? null,
      role: (profile.role as AppRole) ?? null,
      accountStatus: (profile.account_status as AccountStatus) ?? 'pending',
      fullName: profile.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
    };

    request.user = requestUser;
    return true;
  }
}
