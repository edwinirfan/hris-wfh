import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { toRpcErrorPayload } from './rpc-errors';

/**
 * Filter global untuk microservice: semua exception (HttpException dari validasi/domain,
 * error TypeORM, dsb.) diubah menjadi { statusCode, message, errors } agar gateway bisa
 * meneruskannya sebagai HTTP status yang sesuai.
 */
@Catch()
export class AllRpcExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('RpcExceptions');

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    const payload = toRpcErrorPayload(exception);
    if (payload.statusCode >= 500) {
      const context =
        host.getType() === 'rpc' ? host.switchToRpc().getContext<{ getPattern?: () => string }>() : undefined;
      const pattern = context?.getPattern?.();
      this.logger.error(
        `Unhandled error${pattern ? ` on ${String(pattern)}` : ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    return throwError(() => payload);
  }
}
