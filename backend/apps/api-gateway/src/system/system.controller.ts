import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorService, MicroserviceHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_TIMEZONE } from '@app/common';
import { Public } from '../common/decorators';
import { StorageService } from '../files/storage.service';

@ApiTags('System')
@Public()
@SkipThrottle()
@Controller()
export class SystemController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly microservice: MicroserviceHealthIndicator,
    private readonly indicator: HealthIndicatorService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** Jam server — dipakai LiveClock di frontend agar tidak bergantung pada jam perangkat */
  @Get('time')
  time() {
    const now = new Date();
    return { serverTime: now.toISOString(), epochMs: now.getTime(), timezone: APP_TIMEZONE };
  }

  @Get('health')
  @HealthCheck()
  check() {
    const tcp = (name: string, prefix: string) => () =>
      this.microservice.pingCheck(name, {
        transport: Transport.TCP,
        options: {
          host: this.config.getOrThrow<string>(`${prefix}_SERVICE_HOST`),
          port: this.config.getOrThrow<number>(`${prefix}_SERVICE_PORT`),
        },
        timeout: 2000,
      });

    return this.health.check([
      tcp('auth-service', 'AUTH'),
      tcp('employee-service', 'EMPLOYEE'),
      tcp('attendance-service', 'ATTENDANCE'),
      async () => {
        const check = this.indicator.check('storage');
        try {
          await this.storage.ping();
          return check.up({ driver: this.config.get<string>('STORAGE_DRIVER') });
        } catch (error) {
          return check.down({ message: error instanceof Error ? error.message : String(error) });
        }
      },
    ]);
  }
}
