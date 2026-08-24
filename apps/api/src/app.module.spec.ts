import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { createThrottlerOptions } from './app.module';

describe('createThrottlerOptions', () => {
  it('tracks distinct Cloudflare visitors independently', async () => {
    const options = createThrottlerOptions({
      throttleTtl: 60000,
      throttleLimit: 120,
      trustProxy: true,
    }) as Exclude<ThrottlerModuleOptions, unknown[]>;
    const getTracker = options.getTracker;
    expect(getTracker).toBeDefined();

    const first = await getTracker!(
      {
        headers: { 'cf-connecting-ip': '203.0.113.10' },
        ip: '198.51.100.5',
        socket: { remoteAddress: '172.20.0.3' },
      },
      {} as ExecutionContext,
    );
    const second = await getTracker!(
      {
        headers: { 'cf-connecting-ip': '203.0.113.11' },
        ip: '198.51.100.5',
        socket: { remoteAddress: '172.20.0.3' },
      },
      {} as ExecutionContext,
    );

    expect(first).toBe('203.0.113.10');
    expect(second).toBe('203.0.113.11');
    expect(first).not.toBe(second);
  });
});
