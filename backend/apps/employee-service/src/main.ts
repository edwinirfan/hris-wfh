import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, tcpServerOptions } from '@app/common';
import { EmployeeServiceModule } from './employee-service.module';

async function bootstrap() {
  // employee-service hanya publisher event, jadi cukup transport TCP
  const app = await NestFactory.create(EmployeeServiceModule);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('EMPLOYEE_SERVICE_PORT');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllRpcExceptionsFilter());
  app.connectMicroservice<MicroserviceOptions>(tcpServerOptions(port), { inheritAppConfig: true });
  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.init();
  Logger.log(`employee-service siap di TCP :${port}`, 'Bootstrap');
}

void bootstrap();
