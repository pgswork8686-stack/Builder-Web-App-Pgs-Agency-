import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getMe(userId: string) {
    const client = this.supabaseService.getSystemClient();

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    const { data: authUserData, error: authError } =
      await client.auth.admin.getUserById(userId);

    if (authError || !authUserData?.user) {
      throw new NotFoundException('User not found in authentication provider');
    }

    const initialAdminEmail = this.configService.initialAdminEmail;
    const isInitialEmail =
      authUserData.user.email?.toLowerCase() === initialAdminEmail.toLowerCase();

    let canBootstrapAdmin = false;
    if (isInitialEmail && profile?.account_status === 'pending') {
      const { data: existingAdmin } = await client
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('account_status', 'active')
        .maybeSingle();
      if (!existingAdmin) {
        canBootstrapAdmin = true;
      }
    }

    return {
      user: {
        id: authUserData.user.id,
        email: authUserData.user.email ?? null,
        phone: authUserData.user.phone ?? null,
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      },
      account: {
        status: profile?.account_status ?? 'pending',
        role: profile?.role ?? null,
        approvedAt: profile?.approved_at ?? null,
      },
      canBootstrapAdmin,
    };
  }

  async bootstrapAdmin(user: RequestUser) {
    const initialAdminEmail = this.configService.initialAdminEmail;

    if (
      !user.email ||
      user.email.trim().toLowerCase() !== initialAdminEmail.trim().toLowerCase()
    ) {
      throw new ForbiddenException(
        'Only designated initial admin email can perform bootstrap',
      );
    }

    const client = this.supabaseService.getSystemClient();

    // Verify email confirmation using Supabase Auth User record
    const { data: authUserData, error: authError } =
      await client.auth.admin.getUserById(user.authUserId);

    if (authError || !authUserData?.user) {
      throw new NotFoundException('User not found in auth provider');
    }

    // Spec check: email_verified check
    if (!authUserData.user.email_confirmed_at) {
      throw new ForbiddenException(
        'Email must be verified before performing bootstrap',
      );
    }

    // Call atomic database RPC function to ensure transactional integrity
    const { data: rpcResult, error: rpcError } = await client.rpc(
      'bootstrap_initial_admin',
      {
        p_admin_user_id: user.authUserId,
        p_email: user.email,
      },
    );

    if (rpcError) {
      // Map postgres custom exceptions to HTTP status codes
      if (rpcError.code === 'P0001') {
        throw new ForbiddenException(rpcError.message);
      } else if (rpcError.code === 'P0002') {
        throw new ConflictException(rpcError.message);
      } else if (rpcError.code === 'P0004') {
        throw new ConflictException(rpcError.message);
      } else {
        throw new InternalServerErrorException(rpcError.message);
      }
    }

    return {
      message: 'Initial admin bootstrapped successfully',
      user: {
        id: user.authUserId,
        email: user.email,
        role: rpcResult.role,
        account_status: rpcResult.status,
      },
    };
  }
}
