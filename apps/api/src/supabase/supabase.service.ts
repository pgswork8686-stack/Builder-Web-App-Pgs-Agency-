import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private systemClientInstance: SupabaseClient<any, any, any>;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.supabaseUrl;
    const supabaseSecretKey = this.configService.supabaseSecretKey;

    // Initialize the elevated system client
    this.systemClientInstance = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Returns the elevated system client using service_role key.
   * STRICT WARNING: Only use this for system authentication administration
   * and security workflows. Never pass this down to the controller layer or client-facing operations.
   */
  getSystemClient(): SupabaseClient<any, any, any> {
    return this.systemClientInstance;
  }

  /**
   * Creates a user-scoped client utilizing the current user's authorization token
   * to guarantee that Row-Level Security (RLS) policies are correctly evaluated in the DB.
   */
  createUserClient(accessToken: string): SupabaseClient<any, any, any> {
    const supabaseUrl = this.configService.supabaseUrl;
    const supabasePublishableKey = this.configService.supabasePublishableKey;

    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

}
