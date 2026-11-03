import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, EVENT_QUEUES, eventsConsumerOptions, tcpServerOptions } from '@app/common';
import { AttendanceServiceModule } from './attendance-service.module';

async function bootstrap() {
  // Hybrid app: TCP (request-response dari gateway) + RabbitMQ (sinkronisasi employee_refs)
  const app = await NestFactory.create(AttendanceServiceModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('ATTENDANCE_SERVICE_PORT');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllRpcExceptionsFilter());
  app.connectMicroservice<MicroserviceOptions>(tcpServerOptions(port), { inheritAppConfig: true });
  app.connectMicroservice<MicroserviceOptions>(
    eventsConsumerOptions(config.getOrThrow<string>('RABBITMQ_URL'), EVENT_QUEUES.ATTENDANCE),
    { inheritAppConfig: true },
  );
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.init();
  Logger.log(`attendance-service siap di TCP :${port}`, 'Bootstrap');
}

void bootstrap();
