import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface StandardErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as any).requestId ||
      'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Đã xảy ra lỗi nội bộ. Vui lòng thử lại sau.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = exception.name.replace(/Exception$/, '').toUpperCase();
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const body = exceptionResponse as Record<string, any>;
        code =
          body.code || exception.name.replace(/Exception$/, '').toUpperCase();

        if (Array.isArray(body.message)) {
          message = body.message.join(', ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        } else {
          message = exception.message || message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled non-HTTP exception [${requestId}]: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unknown non-standard exception [${requestId}]: ${String(exception)}`,
      );
    }

    // Never leak raw DB / SQL / Supabase connection strings to client
    if (
      message.includes('relation "') ||
      message.includes('column "') ||
      message.includes('syntax error at or near') ||
      message.includes('violates unique constraint') ||
      message.includes('violates foreign key constraint') ||
      message.includes('connection pool exhausted')
    ) {
      message = 'Đã xảy ra lỗi cơ sở dữ liệu. Vui lòng thử lại sau.';
    }

    const payload: StandardErrorResponse = {
      statusCode: status,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(payload);
  }
}
