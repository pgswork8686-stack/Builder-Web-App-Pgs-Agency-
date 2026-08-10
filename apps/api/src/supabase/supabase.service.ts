import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private clientInstance: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.supabaseUrl;
    const supabaseSecretKey = this.configService.supabaseSecretKey;

    if (!supabaseUrl) {
      console.warn('Supabase URL is not configured in ConfigService.');
    }

    // Backend clients typically use the service role key for system operations
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.clientInstance = createClient(
      supabaseUrl || '',
      supabaseSecretKey || '',
    );
  }

  getClient(): SupabaseClient {
    return this.clientInstance;
  }
}
