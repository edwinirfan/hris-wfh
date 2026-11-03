import { ConfigService } from '@nestjs/config';
import { ClientsProviderAsyncOptions, RmqOptions, TcpOptions, Transport } from '@nestjs/microservices';
import { EVENTS_EXCHANGE, EVENTS_PUBLISHER } from './constants';

export function tcpServerOptions(port: number): TcpOptions {
  return { transport: Transport.TCP, options: { host: '0.0.0.0', port } };
}

/**
 * Consumer event: queue durable milik service ini, di-bind ke topic exchange
 * untuk setiap @EventPattern yang terdaftar (wildcards=true).
 */
export function eventsConsumerOptions(url: string, queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue,
      queueOptions: { durable: true },
      exchange: EVENTS_EXCHANGE,
      exchangeType: 'topic',
      wildcards: true,
      noAck: false,
      prefetchCount: 10,
    },
  };
}

/** Publisher event ke topic exchange (routing key = nama event) */
export function eventsPublisherProvider(): ClientsProviderAsyncOptions {
  return {
    name: EVENTS_PUBLISHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      transport: Transport.RMQ,
      options: {
        urls: [config.getOrThrow<string>('RABBITMQ_URL')],
        exchange: EVENTS_EXCHANGE,
        exchangeType: 'topic',
        wildcards: true,
        persistent: true,
      },
    }),
  };
}

export function tcpClientProvider(name: string, hostKey: string, portKey: string): ClientsProviderAsyncOptions {
  return {
    name,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      transport: Transport.TCP,
      options: {
        host: config.getOrThrow<string>(hostKey),
        port: config.getOrThrow<number>(portKey),
      },
    }),
  };
}
