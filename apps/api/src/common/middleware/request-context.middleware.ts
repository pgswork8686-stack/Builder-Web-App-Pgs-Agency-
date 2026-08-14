import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const rawId = req.headers['x-request-id'];
    const requestId =
      typeof rawId === 'string' && rawId.trim() ? rawId.trim() : randomUUID();

    (req as any).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Safe structured log without authorization tokens or sensitive payloads
      this.logger.log(
        `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
