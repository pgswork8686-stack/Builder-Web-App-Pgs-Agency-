import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(
    private readonly nestConfigService: NestConfigService,
  ) {}

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
    return this.nestConfigService.getOrThrow<string>(
      'SUPABASE_SECRET_KEY',
    );
  }

  get initialAdminEmail(): string {
    return this.nestConfigService.getOrThrow<string>(
      'INITIAL_ADMIN_EMAIL',
    );
  }
}
