import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { TimeoutError } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { RpcErrorPayload } from '../interfaces';

function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RpcErrorPayload).statusCode === 'number' &&
    typeof (value as RpcErrorPayload).message === 'string'
  );
}

/** Dipakai di dalam service: exception apa pun → payload yang aman dikirim lewat transport */
export function toRpcErrorPayload(exception: unknown): RpcErrorPayload {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const statusCode = exception.getStatus();
    if (typeof response === 'string') return { statusCode, message: response };
    const body = response as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return { statusCode, message: 'Validasi gagal', errors: body.message };
    }
    return { statusCode, message: body.message ?? exception.message };
  }

  if (exception instanceof RpcException) {
    const error = exception.getError();
    if (isRpcErrorPayload(error)) return error;
    return { statusCode: HttpStatus.BAD_REQUEST, message: typeof error === 'string' ? error : JSON.stringify(error) };
  }

  if (exception instanceof QueryFailedError) {
    const driverError = exception.driverError as { code?: string } | undefined;
    if (driverError?.code === 'ER_DUP_ENTRY') {
      return { statusCode: HttpStatus.CONFLICT, message: 'Data sudah ada (duplikat)' };
    }
    if (driverError?.code === 'ER_NO_REFERENCED_ROW_2') {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Data relasi tidak ditemukan' };
    }
  }

  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Terjadi kesalahan pada server' };
}

/** Dipakai di gateway: error dari ClientProxy → HttpException yang tepat */
export function toHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof TimeoutError) {
    return new GatewayTimeoutException('Layanan tidak merespons, silakan coba lagi');
  }
  if (isRpcErrorPayload(error)) {
    return new HttpException(
      { statusCode: error.statusCode, message: error.message, errors: error.errors },
      error.statusCode,
    );
  }
  const code = (error as { code?: string } | undefined)?.code;
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE') {
    return new ServiceUnavailableException('Layanan sedang tidak tersedia');
  }
  return new InternalServerErrorException('Terjadi kesalahan pada server');
}

/** Cek apakah error duplikat MySQL berasal dari constraint tertentu */
export function isDuplicateOn(error: unknown, constraintName: string): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; sqlMessage?: string } | undefined;
  return driverError?.code === 'ER_DUP_ENTRY' && !!driverError.sqlMessage?.includes(constraintName);
}
