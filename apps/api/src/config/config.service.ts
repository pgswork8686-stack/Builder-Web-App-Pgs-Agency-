import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get(key: string): string {
    return this.nestConfigService.get<string>(key) || '';
  }

  get port(): number {
    return this.nestConfigService.get<number>('PORT') || 3001;
  }

  get webUrl(): string {
    return this.get('WEB_URL');
  }

  get supabaseUrl(): string {
    return this.get('SUPABASE_URL');
  }

  get supabaseSecretKey(): string {
    return this.get('SUPABASE_SECRET_KEY');
  }

  get initialAdminEmail(): string {
    return this.get('INITIAL_ADMIN_EMAIL') || 'pgsword6868@gmail.com';
  }
}
