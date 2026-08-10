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
    return this.nestConfigService.getOrThrow<string>('WEB_URL');
  }

  get supabaseUrl(): string {
    return this.nestConfigService.getOrThrow<string>('SUPABASE_URL');
  }

  get supabasePublishableKey(): string {
    return this.nestConfigService.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
  }

  get supabaseSecretKey(): string {
    return this.nestConfigService.getOrThrow<string>('SUPABASE_SECRET_KEY');
  }

  get initialAdminEmail(): string {
    return this.nestConfigService.get<string>('INITIAL_ADMIN_EMAIL') || 'pgsword6868@gmail.com';
  }
}
