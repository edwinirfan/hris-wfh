import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, EMPLOYEE_SERVICE, tcpClientProvider } from '@app/common';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceFacade } from './attendance/attendance.facade';
import { AuthController } from './auth/auth.controller';
import { HttpThrottlerGuard, JwtAuthGuard, RolesGuard } from './common/guards';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/response.interceptor';
import { gatewayEnvSchema } from './config/env.schema';
import { EmployeesController, MasterDataController } from './employees/employees.controller';
import { EmployeesFacade } from './employees/employees.facade';
import { FilesController } from './files/files.controller';
import { ImageService } from './files/image.service';
import { SignedUrlService } from './files/signed-url.service';
import { StorageService } from './files/storage.service';
import { RealtimeEventsController } from './realtime/realtime-events.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { SystemController } from './system/system.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'], validationSchema: gatewayEnvSchema }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000,
          limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        verifyOptions: { issuer: 'hris-auth-service', audience: 'hris-api' },
      }),
    }),
    ClientsModule.registerAsync([
      tcpClientProvider(AUTH_SERVICE, 'AUTH_SERVICE_HOST', 'AUTH_SERVICE_PORT'),
      tcpClientProvider(EMPLOYEE_SERVICE, 'EMPLOYEE_SERVICE_HOST', 'EMPLOYEE_SERVICE_PORT'),
      tcpClientProvider(ATTENDANCE_SERVICE, 'ATTENDANCE_SERVICE_HOST', 'ATTENDANCE_SERVICE_PORT'),
    ]),
    TerminusModule,
  ],
  controllers: [
    AuthController,
    EmployeesController,
    MasterDataController,
    AttendanceController,
    FilesController,
    SystemController,
    RealtimeEventsController,
  ],
  providers: [
    EmployeesFacade,
    AttendanceFacade,
    ImageService,
    StorageService,
    SignedUrlService,
    RealtimeGateway,
    // Urutan guard: rate limit → autentikasi → otorisasi role
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class ApiGatewayModule {}
