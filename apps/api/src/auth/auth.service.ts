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
    const client = this.supabaseService.getClient();

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

    return {
      id: authUserData.user.id,
      email: authUserData.user.email,
      role: profile?.role ?? null,
      account_status: profile?.account_status ?? 'pending',
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      created_at: profile?.created_at ?? authUserData.user.created_at,
      updated_at: profile?.updated_at ?? authUserData.user.updated_at,
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

    const client = this.supabaseService.getClient();

    // Check user's current profile status
    const { data: profile, error: fetchError } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(fetchError.message);
    }

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    if (profile.account_status !== 'pending') {
      throw new ConflictException('Account is not in pending status');
    }

    // Check if an active admin already exists
    const { data: existingAdmin, error: adminCheckError } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('account_status', 'active')
      .maybeSingle();

    if (adminCheckError) {
      throw new InternalServerErrorException(adminCheckError.message);
    }

    if (existingAdmin) {
      throw new ConflictException('An active admin account already exists');
    }

    // Perform status and role update
    const { data: updatedProfile, error: updateError } = await client
      .from('profiles')
      .update({
        role: 'admin',
        account_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      throw new InternalServerErrorException(
        updateError?.message || 'Failed to update user profile to admin',
      );
    }

    // Log approval event
    const { error: eventError } = await client
      .from('account_approval_events')
      .insert({
        target_user_id: user.id,
        actor_id: user.id,
        action: 'bootstrap_admin',
        previous_status: 'pending',
        new_status: 'active',
        previous_role: null,
        new_role: 'admin',
        notes: 'Initial admin account bootstrap execution',
      });

    if (eventError) {
      // Log or throw if needed, but update succeeded
      console.error('Failed to log bootstrap approval event:', eventError);
    }

    return {
      message: 'Initial admin bootstrapped successfully',
      user: {
        id: updatedProfile.id,
        email: user.email,
        role: updatedProfile.role,
        account_status: updatedProfile.account_status,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url,
      },
    };
  }
}
