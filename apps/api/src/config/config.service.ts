import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly nestConfigService: NestConfigService) {}

  get appEnv(): string {
    return this.nestConfigService.getOrThrow<string>('APP_ENV');
  }

  get port(): number {
    return this.nestConfigService.getOrThrow<number>('PORT');
  }

  get webUrl(): string {
    return this.nestConfigService.getOrThrow<string>('WEB_URL');
  }

  get supabaseUrl(): string {
    return this.nestConfigService.getOrThrow<string>('SUPABASE_URL');
  }

  get supabasePublishableKey(): string {
    return this.nestConfigService.getOrThrow<string>(
      'SUPABASE_PUBLISHABLE_KEY',
    );
  }

  get supabaseSecretKey(): string {
    return this.nestConfigService.getOrThrow<string>('SUPABASE_SECRET_KEY');
  }

  get initialAdminEmail(): string {
    return this.nestConfigService.getOrThrow<string>('INITIAL_ADMIN_EMAIL');
  }

  get throttleTtl(): number {
    return this.nestConfigService.get<number>('THROTTLE_TTL', 60000);
  }

  get throttleLimit(): number {
    return this.nestConfigService.get<number>('THROTTLE_LIMIT', 120);
  }

  get trustProxy(): boolean {
    const configured = this.nestConfigService.get<boolean | undefined>(
      'TRUST_PROXY',
    );
    if (configured !== undefined) {
      return configured;
    }
    return this.appEnv === 'production';
  }

  get calendarificApiKey(): string | undefined {
    return this.nestConfigService.get<string>('CALENDARIFIC_API_KEY');
  }
}
