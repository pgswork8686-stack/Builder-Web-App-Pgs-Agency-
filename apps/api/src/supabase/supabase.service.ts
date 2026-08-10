import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private clientInstance: SupabaseClient<any, any, any>;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.supabaseUrl;
    const supabaseSecretKey = this.configService.supabaseSecretKey;

    // Backend clients use the service role key for system operations
    this.clientInstance = createClient(supabaseUrl, supabaseSecretKey);
  }

  getClient(): SupabaseClient<any, any, any> {
    return this.clientInstance;
  }
}
