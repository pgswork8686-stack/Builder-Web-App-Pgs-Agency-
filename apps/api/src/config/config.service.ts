import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get(key: string): string {
    return process.env[key] || '';
  }

  get port(): number {
    return parseInt(this.get('PORT'), 10) || 3001;
  }

  get supabaseUrl(): string {
    return this.get('SUPABASE_URL') || this.get('NEXT_PUBLIC_SUPABASE_URL');
  }

  get supabaseSecretKey(): string {
    return this.get('SUPABASE_SECRET_KEY');
  }
}
