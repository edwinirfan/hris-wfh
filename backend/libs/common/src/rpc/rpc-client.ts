import { Logger } from '@nestjs/common';
import { ClientProxy, RmqContext } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { toHttpException } from './rpc-errors';

const DEFAULT_RPC_TIMEOUT_MS = 8000;

/** Kirim request TCP ke service dan terjemahkan error-nya menjadi HttpException */
export async function sendRpc<TResult>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
): Promise<TResult> {
  try {
    return await firstValueFrom(client.send<TResult>(pattern, payload).pipe(timeout(timeoutMs)));
  } catch (error) {
    throw toHttpException(error);
  }
}

/**
 * Jalankan handler event lalu ack/nack manual (queue dikonfigurasi noAck=false).
 * Gagal → nack tanpa requeue supaya pesan rusak tidak berputar terus.
 */
export async function handleWithAck(
  context: RmqContext,
  logger: Logger,
  handler: () => Promise<unknown>,
): Promise<void> {
  const channel = context.getChannelRef() as {
    ack: (message: unknown) => void;
    nack: (message: unknown, allUpTo?: boolean, requeue?: boolean) => void;
  };
  const message = context.getMessage() as unknown;
  try {
    await handler();
    channel.ack(message);
  } catch (error) {
    logger.error(`Gagal memproses event ${context.getPattern()}`, error instanceof Error ? error.stack : String(error));
    channel.nack(message, false, false);
  }
}
