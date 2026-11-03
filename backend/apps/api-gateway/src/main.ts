import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { EVENT_QUEUES, eventsConsumerOptions } from '@app/common';
import { ApiGatewayModule } from './api-gateway.module';
import { ConfiguredIoAdapter } from './realtime/realtime.gateway';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(ApiGatewayModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('GATEWAY_PORT');
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());

  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, origins));

  const swagger = new DocumentBuilder()
    .setTitle('HRIS WFH API')
    .setDescription('API Gateway — absensi WFH & monitoring karyawan (NestJS microservices)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, swagger));

  // Gateway juga consumer RabbitMQ: meneruskan event absensi ke Socket.IO
  app.connectMicroservice<MicroserviceOptions>(
    eventsConsumerOptions(config.getOrThrow<string>('RABBITMQ_URL'), EVENT_QUEUES.GATEWAY),
  );
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(port);
  Logger.log(`api-gateway siap di http://localhost:${port}/api/v1 (docs: /api/docs)`, 'Bootstrap');
}

void bootstrap();
