import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountStatus, AppRole, RequestUser } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

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

    // Use user-scoped client with RLS to query own profile
    const userClient = this.supabaseService.createUserClient(token);
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id,email,full_name,avatar_url,role,account_status,approved_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      this.logger.error(`Database profile query error: ${profileError.message}`);
      throw new InternalServerErrorException({
        code: 'PROFILE_LOOKUP_FAILED',
        message: 'Không thể kiểm tra thông tin tài khoản lúc này.',
      });
    }

    if (!profile) {
      throw new ForbiddenException('ACCOUNT_PROFILE_MISSING');
    }

    const status = profile.account_status as AccountStatus;
    if (!status || !['pending', 'active', 'rejected'].includes(status)) {
      throw new ForbiddenException('ACCOUNT_STATE_INVALID');
    }

    const requestUser: RequestUser = {
      authUserId: user.id,
      profileId: profile.id,
      email: user.email ?? null,
      role: (profile.role as AppRole) ?? null,
      accountStatus: status,
      fullName: profile.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
    };

    request.user = requestUser;
    return true;
  }
}
