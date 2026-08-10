import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppRole } from '../auth/auth.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getPendingUsers(page: number = 1, limit: number = 10) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    const client = this.supabaseService.getClient();

    const { data, count, error } = await client
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const items = await Promise.all(
      (data || []).map(async (profile) => {
        const { data: authUserData } = await client.auth.admin.getUserById(
          profile.id,
        );
        return {
          id: profile.id,
          email: authUserData?.user?.email ?? null,
          full_name: profile.full_name ?? null,
          avatar_url: profile.avatar_url ?? null,
          account_status: profile.account_status,
          role: profile.role,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        };
      }),
    );

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      data: items,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  async approveUser(adminUserId: string, targetUserId: string, role: AppRole) {
    if (role === 'admin') {
      throw new BadRequestException(
        'Cannot assign admin role through user approval endpoint',
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

    const client = this.supabaseService.getClient();

    const { data: profile, error: fetchError } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(fetchError.message);
    }

    if (!profile) {
      throw new NotFoundException('Target user profile not found');
    }

    if (profile.account_status !== 'pending') {
      throw new ConflictException('Only pending users can be approved');
    }

    const { data: updatedProfile, error: updateError } = await client
      .from('profiles')
      .update({
        role: role,
        account_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      throw new InternalServerErrorException(
        updateError?.message || 'Failed to approve user',
      );
    }

    const { error: eventError } = await client
      .from('account_approval_events')
      .insert({
        target_user_id: targetUserId,
        actor_id: adminUserId,
        action: 'approve',
        previous_status: 'pending',
        new_status: 'active',
        previous_role: null,
        new_role: role,
        notes: `Approved by admin (${adminUserId})`,
      });

    if (eventError) {
      console.error('Failed to log approve approval event:', eventError);
    }

    const { data: authUserData } =
      await client.auth.admin.getUserById(targetUserId);

    return {
      message: 'User approved successfully',
      user: {
        id: updatedProfile.id,
        email: authUserData?.user?.email ?? null,
        role: updatedProfile.role,
        account_status: updatedProfile.account_status,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url,
      },
    };
  }

  async rejectUser(adminUserId: string, targetUserId: string, reason?: string) {
    const client = this.supabaseService.getClient();

    const { data: profile, error: fetchError } = await client
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(fetchError.message);
    }

    if (!profile) {
      throw new NotFoundException('Target user profile not found');
    }

    if (profile.account_status !== 'pending') {
      throw new ConflictException('Only pending users can be rejected');
    }

    const { data: updatedProfile, error: updateError } = await client
      .from('profiles')
      .update({
        role: null,
        account_status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      throw new InternalServerErrorException(
        updateError?.message || 'Failed to reject user',
      );
    }

    const { error: eventError } = await client
      .from('account_approval_events')
      .insert({
        target_user_id: targetUserId,
        actor_id: adminUserId,
        action: 'reject',
        previous_status: 'pending',
        new_status: 'rejected',
        previous_role: null,
        new_role: null,
        notes: reason || 'Rejected by admin',
      });

    if (eventError) {
      console.error('Failed to log reject approval event:', eventError);
    }

    const { data: authUserData } =
      await client.auth.admin.getUserById(targetUserId);

    return {
      message: 'User rejected successfully',
      user: {
        id: updatedProfile.id,
        email: authUserData?.user?.email ?? null,
        role: updatedProfile.role,
        account_status: updatedProfile.account_status,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url,
      },
    };
  }
}
