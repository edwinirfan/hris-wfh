import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { EVENTS_PUBLISHER } from '../constants';

/**
 * Publish event ke RabbitMQ. Kegagalan publish dicatat tapi tidak menggagalkan
 * transaksi bisnis — attendance-service punya fallback sinkronisasi on-demand.
 * (Peningkatan berikutnya: transactional outbox.)
 */
@Injectable()
export class EventPublisher {
  private readonly logger = new Logger(EventPublisher.name);

  constructor(@Inject(EVENTS_PUBLISHER) private readonly client: ClientProxy) {}

  async publish(pattern: string, payload: unknown): Promise<void> {
    try {
      await lastValueFrom(this.client.emit(pattern, payload).pipe(timeout(5000)), { defaultValue: undefined });
    } catch (error) {
      this.logger.error(`Gagal publish event ${pattern}`, error instanceof Error ? error.stack : String(error));
    }
  }
}
