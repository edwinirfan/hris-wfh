import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, EVENT_QUEUES, eventsConsumerOptions, tcpServerOptions } from '@app/common';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  // Hybrid app: TCP (request-response dari gateway) + RabbitMQ (consumer event)
  const app = await NestFactory.create(AuthServiceModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('AUTH_SERVICE_PORT');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllRpcExceptionsFilter());
  app.connectMicroservice<MicroserviceOptions>(tcpServerOptions(port), { inheritAppConfig: true });
  app.connectMicroservice<MicroserviceOptions>(
    eventsConsumerOptions(config.getOrThrow<string>('RABBITMQ_URL'), EVENT_QUEUES.AUTH),
    { inheritAppConfig: true },
  );
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.init();
  Logger.log(`auth-service siap di TCP :${port}`, 'Bootstrap');
}

void bootstrap();
