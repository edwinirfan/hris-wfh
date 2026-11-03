import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from './decorators';

/** Bungkus semua response HTTP sukses: { success: true, message, data } */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const message = this.reflector.get<string | undefined>(RESPONSE_MESSAGE_KEY, context.getHandler()) ?? null;
    return next
      .handle()
      .pipe(
        map((data: unknown) =>
          data instanceof StreamableFile ? data : { success: true, message, data: data ?? null },
        ),
      );
  }
}
