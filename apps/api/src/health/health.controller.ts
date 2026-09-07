import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'pgs-hub-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLive() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReady() {
    const start = Date.now();
    try {
      const client = this.supabaseService.getSystemClient();
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) {
        throw error;
      }
      const latencyMs = Date.now() - start;
      return {
        status: 'ready',
        database: 'connected',
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new HttpException(
        {
          status: 'unhealthy',
          database: 'disconnected',
          error: err?.message || 'Database probe failed',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
