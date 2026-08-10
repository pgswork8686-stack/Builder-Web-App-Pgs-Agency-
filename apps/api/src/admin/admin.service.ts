import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppRole } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getPendingUsers(page: number = 1, pageSize: number = 20) {
    const pageNum = Math.max(1, page);
    const sizeNum = Math.min(100, Math.max(1, pageSize));
    const offset = (pageNum - 1) * sizeNum;

    const client = this.supabaseService.getSystemClient();

    const { data, count, error } = await client
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + sizeNum - 1);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const items = (data || []).map((profile) => ({
      id: profile.id,
      email: profile.email ?? null,
      fullName: profile.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      accountStatus: profile.account_status,
      role: profile.role,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    }));

    const total = count ?? 0;

    return {
      items,
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        total,
      },
    };
  }

  async approveUser(adminUserId: string, targetUserId: string, role: AppRole) {
    if (role === 'admin') {
      throw new BadRequestException(
        'Cannot assign admin role through user approval workflow',
      );
    }

    const allowedRoles: AppRole[] = [
      'employee',
      'team_leader',
      'accountant',
      'client',
    ];

    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${allowedRoles.join(', ')}`,
      );
    }

    const client = this.supabaseService.getSystemClient();

    // Call atomic RPC
    const { data: rpcResult, error: rpcError } = await client.rpc(
      'approve_pending_account',
      {
        p_admin_user_id: adminUserId,
        p_target_user_id: targetUserId,
        p_role: role,
      },
    );

    if (rpcError) {
      if (rpcError.code === 'P0005') {
        throw new ForbiddenException(rpcError.message);
      } else if (rpcError.code === 'P0006') {
        throw new BadRequestException(rpcError.message);
      } else if (rpcError.code === 'P0007') {
        throw new NotFoundException(rpcError.message);
      } else if (rpcError.code === 'P0008') {
        throw new ConflictException(rpcError.message);
      } else {
        throw new InternalServerErrorException(rpcError.message);
      }
    }

    // Retrieve target profile for response
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    return {
      message: 'User approved successfully',
      user: {
        id: targetUserId,
        email: profile?.email ?? null,
        role: rpcResult.role,
        account_status: rpcResult.status,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  }

  async rejectUser(adminUserId: string, targetUserId: string, reason: string) {
    if (!reason || reason.trim().length < 3 || reason.trim().length > 500) {
      throw new BadRequestException(
        'Rejection reason must be between 3 and 500 characters',
      );
    }

    const client = this.supabaseService.getSystemClient();

    // Call atomic RPC
    const { data: rpcResult, error: rpcError } = await client.rpc(
      'reject_pending_account',
      {
        p_admin_user_id: adminUserId,
        p_target_user_id: targetUserId,
        p_reason: reason.trim(),
      },
    );

    if (rpcError) {
      if (rpcError.code === 'P0005') {
        throw new ForbiddenException(rpcError.message);
      } else if (rpcError.code === 'P0007') {
        throw new NotFoundException(rpcError.message);
      } else if (rpcError.code === 'P0008') {
        throw new ConflictException(rpcError.message);
      } else if (rpcError.code === 'P0009') {
        throw new BadRequestException(rpcError.message);
      } else {
        throw new InternalServerErrorException(rpcError.message);
      }
    }

    // Retrieve target profile for response
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    return {
      message: 'User rejected successfully',
      user: {
        id: targetUserId,
        email: profile?.email ?? null,
        role: rpcResult.role,
        account_status: rpcResult.status,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  }
}
