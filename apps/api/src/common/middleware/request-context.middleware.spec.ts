import type { NextFunction, Request, Response } from 'express';
import { ConfigService } from '../../config/config.service';
import {
  RequestContextMiddleware,
  resolveRequestId,
} from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  it('preserves a bounded caller request ID', () => {
    expect(resolveRequestId(' deploy-check_123 ')).toBe('deploy-check_123');
  });

  it.each([
    '',
    'contains spaces',
    'x'.repeat(129),
    'request-id\nforged-log-line',
  ])('replaces an invalid request ID', (value) => {
    expect(resolveRequestId(value)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns the resolved request ID on the response', () => {
    const configService = {
      appEnv: 'test',
      trustProxy: true,
    } as ConfigService;
    const middleware = new RequestContextMiddleware(configService);
    const req = {
      method: 'GET',
      path: '/api/v1/health',
      originalUrl: '/api/v1/health?token=must-not-be-logged',
      ip: '198.51.100.4',
      socket: { remoteAddress: '172.20.0.3' },
      headers: {
        'x-request-id': 'smoke-test',
        'cf-connecting-ip': '203.0.113.9',
      },
    } as unknown as Request;
    const listeners = new Map<string, () => void>();
    const setHeader = jest.fn();
    const res = {
      setHeader,
      on: jest.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
      }),
      statusCode: 200,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'smoke-test');
    expect(
      (req as Request & { clientIp: string; requestId: string }).clientIp,
    ).toBe('203.0.113.9');
    expect(
      (req as Request & { clientIp: string; requestId: string }).requestId,
    ).toBe('smoke-test');
    expect(next).toHaveBeenCalledTimes(1);
    expect(listeners.has('finish')).toBe(true);
  });
});
