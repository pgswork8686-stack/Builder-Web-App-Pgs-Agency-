import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConfigService } from '../../config/config.service';
import { resolveClientIp } from '../network/client-ip';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function resolveRequestId(value: unknown): string {
  if (typeof value !== 'string') {
    return randomUUID();
  }

  const candidate = value.trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const rawId = req.headers['x-request-id'];
    const requestId = resolveRequestId(rawId);
    const clientIp = resolveClientIp(req, this.configService.trustProxy);

    const contextualRequest = req as Request & {
      requestId: string;
      clientIp: string;
    };
    contextualRequest.requestId = requestId;
    contextualRequest.clientIp = clientIp;
    res.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();
    const { method } = req;
    const path = req.originalUrl.split('?', 1)[0] || req.path;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      if (this.configService.appEnv === 'production') {
        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'pgs-hub-api',
            environment: this.configService.appEnv,
            requestId,
            clientIp,
            method,
            path,
            statusCode,
            durationMs: duration,
          }),
        );
      } else {
        this.logger.log(
          `[${requestId}] ${method} ${path} ${statusCode} - ${duration}ms`,
        );
      }
    });

    next();
  }
}
