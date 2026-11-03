import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

const FRIENDLY_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Ukuran foto maksimal 2 MB',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Terlalu banyak permintaan, silakan coba lagi sebentar lagi',
};

/** Format error konsisten: { success: false, statusCode, message, errors?, path, timestamp } */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(
        'Unhandled non-HTTP exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan pada server';
    let errors: string[] | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as { message?: string | string[]; errors?: string[]; details?: unknown };
        if (Array.isArray(payload.message)) {
          message = 'Validasi gagal';
          errors = payload.message;
        } else {
          message = payload.message ?? exception.message;
          errors = payload.errors;
        }
        details = payload.details;
      }
      message = FRIENDLY_MESSAGES[statusCode] ?? message;
    } else {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      ...(errors?.length ? { errors } : {}),
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
