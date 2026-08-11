import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getMe(user: RequestUser) {
    const client = this.supabaseService.getSystemClient();

    const initialAdminEmail = this.configService.initialAdminEmail;
    const isInitialEmail =
      user.email?.toLowerCase() === initialAdminEmail.toLowerCase();

    let canBootstrapAdmin = false;
    if (isInitialEmail && user.accountStatus === 'pending') {
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
        id: user.authUserId,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      account: {
        status: user.accountStatus,
        role: user.role,
        approvedAt: user.approvedAt,
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
      throw new ForbiddenException({
        code: 'INITIAL_ADMIN_NOT_ALLOWED',
        message: 'Only designated initial admin email can perform bootstrap',
      });
    }

    const client = this.supabaseService.getSystemClient();

    // Verify email confirmation using Supabase Auth User record
    const { data: authUserData, error: authError } =
      await client.auth.admin.getUserById(user.authUserId);

    if (authError || !authUserData?.user) {
      this.logger.error(`Failed to verify auth user in bootstrap: ${authError?.message}`);
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found in auth provider',
      });
    }

    // Spec check: email_verified check
    if (!authUserData.user.email_confirmed_at) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Email must be verified before performing bootstrap',
      });
    }

    // Call atomic database RPC function to ensure transactional integrity
    const { data: rpcResult, error: rpcError } = await client.rpc(
      'bootstrap_initial_admin',
      {
        p_admin_user_id: user.authUserId,
      },
    );

    if (rpcError) {
      this.logger.error(`Bootstrap admin failed: ${rpcError.message} (${rpcError.code})`);
      // Map postgres custom exceptions to HTTP status codes
      if (rpcError.code === 'P0001') {
        throw new ForbiddenException({
          code: 'INITIAL_ADMIN_NOT_ALLOWED',
          message: 'Tài khoản email này không được chỉ định làm Admin.',
        });
      } else if (rpcError.code === 'P0002') {
        throw new ConflictException({
          code: 'ADMIN_ALREADY_EXISTS',
          message: 'Admin hệ thống đã tồn tại.',
        });
      } else if (rpcError.code === 'P0004') {
        throw new ConflictException({
          code: 'ACCOUNT_NOT_PENDING',
          message: 'Tài khoản không ở trạng thái chờ duyệt.',
        });
      } else {
        throw new InternalServerErrorException({
          code: 'ACCOUNT_OPERATION_FAILED',
          message: 'Thao tác bootstrap admin thất bại.',
        });
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
